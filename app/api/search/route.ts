import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { embedTextToVectorLiteral } from '@/lib/server/embedder';
import { diversifyTracks } from '@/lib/server/diversify';

export async function POST(req: Request) {
  try {
    const { vibe, searchQuery, selectedTag } = await req.json();

    // ── Feature mapping ──────────────────────────────────────────────────────
    // vibe: 0 (chill) → 100 (peak energy), maps to aggressiveness [0, 1]
    const targetEnergy   = typeof vibe === 'number' ? Math.max(0, Math.min(1, vibe / 100)) : 0.5;

    // BPM: chill ~60–90, moderate ~90–130, high energy ~130–180
    const targetBpm      = Math.round(60 + targetEnergy * 120);

    // Relaxed is roughly the inverse of energy, with a sharper decay at the top end
    const targetRelaxed  = Math.max(0, 1 - targetEnergy * 1.1);

    // Danceability rises with energy but plateaus; very low energy is not very danceable
    const targetDance    = targetEnergy < 0.3
      ? targetEnergy * 0.8
      : 0.3 + targetEnergy * 0.55;

    // Happy is largely independent of energy — high energy can be joyful OR aggressive.
    // We only dip happy slightly at extreme low energy (ambient/melancholic territory).
    const targetHappy    = targetEnergy < 0.2 ? 0.35 : 0.45 + targetEnergy * 0.2;

    // ── Embedding text ────────────────────────────────────────────────────────
    const isKeywordSearch = !!searchQuery?.trim();
    const isTagSearch     = !!selectedTag;
    const searchPattern   = isKeywordSearch ? `%${searchQuery.trim()}%` : null;

    let textToEmbed: string;
    if (isKeywordSearch) {
      // Expand the raw query with light musical framing so the vector lands in
      // the right neighbourhood even when the query is a single word (e.g. "jazz").
      textToEmbed = `Music track matching: ${searchQuery}. Style and genre: ${searchQuery}.`;
    } else {
      const styleLabel = targetEnergy < 0.25
        ? "ambient and very chill"
        : targetEnergy < 0.50
        ? "laid-back and relaxed"
        : targetEnergy < 0.75
        ? "upbeat and driving"
        : "intense and high energy";

      const moodLabel =
        selectedTag === 'happy'   ? "happy and uplifting" :
        selectedTag === 'sad'     ? "melancholic and emotional" :
        selectedTag === 'dance'   ? "danceable and rhythmic" :
        selectedTag === 'relaxed' ? "calm and soothing" :
        targetEnergy < 0.4        ? "calm and introspective" : "powerful and driving";

      textToEmbed = [
        `Track: music.`,
        `Genre: Unknown.`,
        `BPM: ${targetBpm}.`,
        `Energy: ${targetEnergy.toFixed(2)}.`,
        `Style: ${styleLabel}.`,
        `Mood: ${moodLabel}.`,
        `Danceability: ${targetDance.toFixed(2)}.`,
        `Mood happy: ${targetHappy.toFixed(2)}.`,
        `Mood relaxed: ${targetRelaxed.toFixed(2)}.`,
      ].join(' ');
    }

    const queryVector = await embedTextToVectorLiteral(textToEmbed);

    // ── SQL: two-step CTE for clarity and a single unified score ─────────────
    //
    // Step 1 – candidates: pre-compute raw signals per track.
    //   In slider-only mode we pre-filter by BPM window to shrink the scan.
    //   In keyword / tag modes we skip the BPM filter so nothing is missed.
    //
    // Step 2 – scored: combine signals into `hybrid_score` with mode-aware weights:
    //   • Keyword mode  → keyword match + semantics (ignore slider energy targets)
    //   • Tag mode      → tag affinity + semantics + broad energy alignment
    //   • Slider mode   → semantics + energy distance + relaxed distance + BPM proximity
    //
    // We fetch a larger candidate pool (CANDIDATE_POOL) and let JS handle
    // artist diversity before slicing to the final result count (RESULT_LIMIT).

    const CANDIDATE_POOL = 50;
    const RESULT_LIMIT   = 12;

    const sql = `
      WITH candidates AS (
        SELECT
          id,
          track_name                          AS name,
          artist_names[1]                     AS artist,
          track_url,
          bpm,
          COALESCE(aggressiveness,  0.5)      AS energy,
          COALESCE(mood_relaxed,    0.5)      AS mood_relaxed,
          COALESCE(danceability,    0.5)      AS danceability,
          COALESCE(mood_happy,      0.5)      AS mood_happy,
          COALESCE(mood_sad,        0.2)      AS mood_sad,

          -- Semantic distance — lower is closer (cosine via pgvector <->)
          (embedding <-> $1::vector)          AS vec_dist,

          -- Keyword relevance (1 = exact title match … 0 = no match)
          (CASE
            WHEN $4::text IS NULL                                                 THEN 0.0
            WHEN track_name  ILIKE $4                                             THEN 1.0
            WHEN EXISTS (SELECT 1 FROM unnest(artist_names) a WHERE a ILIKE $4)  THEN 0.8
            WHEN genre       ILIKE $4                                             THEN 0.5
            ELSE 0.0
          END)                                AS kw_score,

          -- BPM proximity: 1 = exact match, 0 = ≥140 BPM away (assumed max range)
          1.0 - LEAST(ABS(COALESCE(bpm, 120) - $6::float) / 140.0, 1.0)
                                              AS bpm_score,

          -- Signed distances (used in slider-mode penalties)
          ABS(COALESCE(aggressiveness, 0.5) - $2::float)  AS energy_dist,
          ABS(COALESCE(mood_relaxed,   0.5) - $3::float)  AS relaxed_dist

        FROM tracks
        -- Tag hard-filter: when a tag is active, only tracks that genuinely
        -- score high on that feature are considered (threshold: 0.6).
        -- BPM window is skipped in keyword/tag modes to avoid missing results.
        WHERE (
          $5::text IS NULL
          OR (
            ($5 = 'dance'   AND COALESCE(danceability,  0.5) >= 0.6)
         OR ($5 = 'happy'   AND COALESCE(mood_happy,    0.5) >= 0.6)
         OR ($5 = 'sad'     AND COALESCE(mood_sad,      0.2) >= 0.6)
         OR ($5 = 'relaxed' AND COALESCE(mood_relaxed,  0.5) >= 0.6)
          )
        )
        AND (
          $4::text IS NOT NULL
          OR $5::text IS NOT NULL
          OR COALESCE(bpm, 120) BETWEEN ($6::float - 45) AND ($6::float + 45)
        )
      ),

      scored AS (
        SELECT
          *,
          CASE
            -- ① Keyword mode: surface the best textual + semantic matches;
            --   energy targets are irrelevant when the user typed something specific.
            WHEN $4::text IS NOT NULL THEN
                kw_score                          * 0.55
              + (1.0 - LEAST(vec_dist, 1.0))      * 0.45

            -- ② Tag mode: tracks are already hard-filtered to high tag-feature values.
            --   Rank survivors by semantics + energy alignment from the slider.
            WHEN $5::text IS NOT NULL THEN
                (1.0 - LEAST(vec_dist, 1.0))      * 0.60
              + (1.0 - energy_dist)               * 0.25
              + bpm_score                         * 0.15

            -- ③ Pure slider mode: balance semantics, energy, mood, and BPM proximity.
            ELSE
                (1.0 - LEAST(vec_dist, 1.0))      * 0.40
              + (1.0 - energy_dist)               * 0.25
              + (1.0 - relaxed_dist)              * 0.15
              + bpm_score                         * 0.20
          END AS hybrid_score
        FROM candidates
      )

      SELECT *
      FROM   scored
      ORDER  BY hybrid_score DESC
      LIMIT  $7
    `;

    const { rows } = await query(sql, [
      queryVector,       // $1 — embedding vector
      targetEnergy,      // $2 — target energy/aggressiveness
      targetRelaxed,     // $3 — target mood_relaxed
      searchPattern,     // $4 — keyword ILIKE pattern (or null)
      selectedTag || null, // $5 — mood tag (or null)
      targetBpm,         // $6 — target BPM
      CANDIDATE_POOL,    // $7 — how many candidates to pull before JS re-ranking
    ]);

    if (rows.length === 0) {
      return NextResponse.json({ tracks: [] });
    }

    // ── Artist diversity pass ─────────────────────────────────────────────────
    // Prevents the same artist dominating the top-12 by using a sliding window:
    // if the last `windowSize` results share an artist, we skip that artist
    // temporarily and take the next best from a different one.
    const diverse = diversifyTracks(rows, RESULT_LIMIT, 2);

    const tracks = diverse.map(r => {
      const aggressiveness = parseFloat(r.energy);
      const danceability   = parseFloat(r.danceability);
      // Normalise BPM into [0, 1] using the same 60–200 range assumed at ingest
      const bpmNorm        = Math.max(0, Math.min(1, ((r.bpm ?? 120) - 60) / 140));

      // Composite score weights: aggressiveness is the primary signal,
      // BPM and danceability fill in where aggressiveness undershoots.
      const composite = aggressiveness * 0.55 + bpmNorm * 0.30 + danceability * 0.15;

      // Thresholds: < 0.35 → Chill, 0.35–0.60 → Steady, > 0.60 → High Energy
      // (lowered from 0.65 — aggressiveness alone rarely exceeds that in practice)
      const label =
        composite < 0.35 ? 'Chill' :
        composite > 0.60 ? 'High Energy' :
        'Steady';

      return {
        id:          r.id,
        name:        r.name,
        artist:      r.artist || 'Unknown',
        trackUrl:    r.track_url ?? null,
        bpm:         r.bpm,
        energy:      label,
        energyValue: parseFloat(composite.toFixed(3)),
      };
    });

    return NextResponse.json({ tracks });

  } catch (error: any) {
    console.error('[Search Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}