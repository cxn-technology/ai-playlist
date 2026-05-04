import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { embedTextToVectorLiteral } from '@/lib/server/embedder';
import { diversifyTracks } from '@/lib/server/diversify';
import type { DjClientFilterInput, DjParsedFilters } from '@/lib/llm/dj-filters';
import { mergeDjFilters, normalizeParsedFilters } from '@/lib/llm/dj-filters';
import { parseDjPrompt } from '@/lib/llm/parseDjPrompt';

export const maxDuration = 120;

const CANDIDATE_POOL = 250;

function bpmMidpoint(f: DjParsedFilters): number {
  const { bpm_min: lo, bpm_max: hi } = f;
  if (lo != null && hi != null) return (lo + hi) / 2;
  if (lo != null) return lo + 12;
  if (hi != null) return hi - 12;
  return 120;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const filtersInput = body.filters as DjClientFilterInput | undefined;
    const previewOnly = Boolean(body.previewOnly);

    let merged: DjParsedFilters;

    if (filtersInput?.skipLlm) {
      const base = normalizeParsedFilters(
        filtersInput as Partial<DjParsedFilters>
      );
      if (!base.embedding_narrative?.trim()) {
        return NextResponse.json(
          { error: 'embedding_narrative is required when skipLlm is true' },
          { status: 400 }
        );
      }
      merged = mergeDjFilters(base, filtersInput);
    } else if (prompt) {
      if (!process.env.OPENAI_API_KEY?.trim()) {
        return NextResponse.json(
          {
            error:
              'OPENAI_API_KEY is not configured. Add it to .env for prompt analysis.',
          },
          { status: 501 }
        );
      }
      const llm = await parseDjPrompt(prompt);
      merged = mergeDjFilters(llm, filtersInput ?? null);
    } else if (filtersInput?.embedding_narrative?.trim()) {
      merged = mergeDjFilters(
        normalizeParsedFilters(filtersInput as Partial<DjParsedFilters>),
        filtersInput
      );
    } else {
      return NextResponse.json(
        {
          error:
            'Provide a non-empty prompt, or filters with embedding_narrative and skipLlm true',
        },
        { status: 400 }
      );
    }

    if (previewOnly) {
      return NextResponse.json({ parsedFilters: merged, tracks: [] });
    }

    const queryVector = await embedTextToVectorLiteral(merged.embedding_narrative);
    const targetEnergy = (merged.energy_low + merged.energy_high) / 2;
    const targetRelaxed = Math.max(0, 1 - targetEnergy * 1.1);
    const bpmMid = bpmMidpoint(merged);
    const preferDance = merged.prefer_danceable;

    const sql = `
      WITH candidates AS (
        SELECT
          id,
          track_name AS name,
          artist_names[1] AS artist,
          track_url,
          bpm,
          genre,
          label,
          musical_key,
          COALESCE(aggressiveness, 0.5) AS energy,
          COALESCE(mood_relaxed, 0.5) AS mood_relaxed,
          COALESCE(danceability, 0.5) AS danceability,
          (embedding <-> $1::vector) AS vec_dist,
          1.0 - LEAST(ABS(COALESCE(bpm, 120) - $4::double precision) / 140.0, 1.0) AS bpm_score
        FROM tracks
        WHERE
          ($5::int IS NULL OR (bpm IS NOT NULL AND bpm >= $5))
          AND ($6::int IS NULL OR (bpm IS NOT NULL AND bpm <= $6))
          AND (NOT $7::boolean OR is_explicit IS NOT TRUE)
          AND (
            COALESCE(array_length($8::text[], 1), 0) = 0
            OR EXISTS (
              SELECT 1 FROM unnest($8::text[]) AS g
              WHERE COALESCE(genre, '') ILIKE ('%' || g || '%')
            )
          )
          AND (
            COALESCE(array_length($9::text[], 1), 0) = 0
            OR EXISTS (
              SELECT 1 FROM unnest(artist_names) a
              CROSS JOIN unnest($9::text[]) inc
              WHERE a ILIKE ('%' || inc || '%')
            )
          )
          AND (
            COALESCE(array_length($10::text[], 1), 0) = 0
            OR NOT EXISTS (
              SELECT 1 FROM unnest(artist_names) a
              CROSS JOIN unnest($10::text[]) exc
              WHERE a ILIKE ('%' || exc || '%')
            )
          )
          AND (
            COALESCE(array_length($11::text[], 1), 0) = 0
            OR EXISTS (
              SELECT 1 FROM unnest($11::text[]) lb
              WHERE COALESCE(label, '') ILIKE ('%' || lb || '%')
            )
          )
          AND (
            COALESCE(array_length($12::text[], 1), 0) = 0
            OR EXISTS (
              SELECT 1 FROM unnest($12::text[]) mk
              WHERE COALESCE(musical_key, '') ILIKE ('%' || mk || '%')
            )
          )
      ),
      scored AS (
        SELECT
          *,
          (1.0 - LEAST(vec_dist, 1.0)) * 0.38
          + (1.0 - ABS(energy - $2::double precision)) * 0.24
          + (1.0 - ABS(mood_relaxed - $3::double precision)) * 0.14
          + bpm_score * 0.14
          + CASE WHEN $13::boolean THEN COALESCE(danceability, 0.5) * 0.10 ELSE 0.0 END
          AS hybrid_score
        FROM candidates
      )
      SELECT * FROM scored
      ORDER BY hybrid_score DESC
      LIMIT $14
    `;

    const params = [
      queryVector,
      targetEnergy,
      targetRelaxed,
      bpmMid,
      merged.bpm_min,
      merged.bpm_max,
      merged.require_clean,
      merged.genres.length ? merged.genres : [],
      merged.suggested_artists_include.length ? merged.suggested_artists_include : [],
      merged.suggested_artists_exclude.length ? merged.suggested_artists_exclude : [],
      merged.suggested_labels.length ? merged.suggested_labels : [],
      merged.musical_keys.length ? merged.musical_keys : [],
      preferDance,
      CANDIDATE_POOL,
    ];

    const { rows } = await query(sql, params);

    if (rows.length === 0) {
      return NextResponse.json({
        tracks: [],
        parsedFilters: merged,
        message: 'No tracks matched filters. Try widening BPM or removing genre filters.',
      });
    }

    const diverse = diversifyTracks(rows, merged.requested_track_count, 2);

    const tracks = diverse.map((r: Record<string, unknown>) => {
      const aggressiveness = parseFloat(String(r.energy));
      const danceability = parseFloat(String(r.danceability));
      const bpmNorm = Math.max(
        0,
        Math.min(1, ((Number(r.bpm) || 120) - 60) / 140)
      );
      const composite =
        aggressiveness * 0.55 + bpmNorm * 0.3 + danceability * 0.15;
      const energyLabel =
        composite < 0.35 ? 'Chill' : composite > 0.6 ? 'High Energy' : 'Steady';

      return {
        id: r.id,
        name: r.name,
        artist: r.artist || 'Unknown',
        trackUrl: r.track_url ?? null,
        bpm: r.bpm,
        genre: r.genre ?? null,
        label: r.label ?? null,
        musicalKey: r.musical_key ?? null,
        energy: energyLabel,
        energyValue: parseFloat(composite.toFixed(3)),
      };
    });

    return NextResponse.json({
      tracks,
      parsedFilters: merged,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Prompt recommendation failed';
    console.error('[prompt-recommend]', e);
    if (msg.includes('OPENAI_API_KEY')) {
      return NextResponse.json({ error: msg }, { status: 501 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
