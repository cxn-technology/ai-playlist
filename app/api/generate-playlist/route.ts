import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { embedTextToVectorLiteral } from '@/lib/server/embedder';

// Composite energy = weighted blend of danceability, engagement, aggressiveness
const ENERGY_EXPR = `(COALESCE(danceability, 0.5) * 0.4 + COALESCE(engagement, 0.5) * 0.35 + COALESCE(aggressiveness, 0.5) * 0.25)`;

function getSegmentLabel(index: number, total: number, energy: number): string {
  if (index === 0) return "Opener";
  if (index === total - 1) return "Closer";
  if (energy < 0.4) return "Breather";
  if (energy < 0.55) return "Mid-Set";
  if (energy < 0.7) return "Build";
  if (energy < 0.85) return "Peak";
  return "Climax";
}

export async function POST(req: Request) {
  try {
    const config = await req.json();
    const { eventType, venueSize, genres, energyFlow, durationHours, ageRange } = config;

    const textToEmbed = [
      `DJ set for a ${eventType || 'event'} at a ${venueSize || 'venue'} venue.`,
      genres?.length ? `Genres: ${genres.join(", ")}.` : "",
      ageRange ? `Audience age: ${ageRange}.` : "",
      energyFlow ? `Energy flow: ${energyFlow}.` : "",
    ].filter(Boolean).join(" ");

    const queryVector = await embedTextToVectorLiteral(textToEmbed);

    let targetEnergies: number[];
    if (energyFlow === "peak-valley") {
      targetEnergies = [0.35, 0.85, 0.45, 0.9, 0.4, 0.85];
    } else if (energyFlow === "build-up") {
      targetEnergies = [0.25, 0.4, 0.58, 0.72, 0.88, 0.95];
    } else {
      targetEnergies = [0.55, 0.6, 0.62, 0.6, 0.58, 0.6];
    }

    const numSegments = Math.max(4, Math.round(durationHours ?? 4));
    const energyCurve: number[] = Array.from({ length: numSegments }, (_, i) => {
      const pos = (i / (numSegments - 1)) * (targetEnergies.length - 1);
      const lo = Math.floor(pos);
      const hi = Math.min(lo + 1, targetEnergies.length - 1);
      const frac = pos - lo;
      return targetEnergies[lo] + frac * (targetEnergies[hi] - targetEnergies[lo]);
    });

    const usedIds = new Set<string>();
    const generatedPlaylist = [];

    for (let i = 0; i < energyCurve.length; i++) {
      const target = energyCurve[i];

      const exclusionClause = usedIds.size > 0
        ? `AND id != ALL(ARRAY[${[...usedIds].map((_, j) => `$${j + 3}`).join(",")}]::uuid[])`
        : "";

      const baseParams: any[] = [queryVector, target, ...usedIds];
      let paramIndex = baseParams.length + 1;

      let sql = `
        SELECT
          id,
          track_name AS name,
          artist_names[1] AS artist,
          track_url,
          bpm,
          genre,
          danceability,
          mood_happy,
          mood_relaxed,
          approachability,
          ${ENERGY_EXPR} AS energy
        FROM tracks
        WHERE 1=1
        ${exclusionClause}
      `;

      if (genres && genres.length > 0) {
        sql += ` AND genre = ANY($${paramIndex})`;
        baseParams.push(genres);
        paramIndex++;
      }

      sql += `
        ORDER BY
          (embedding <-> $1) * 0.5 + ABS(${ENERGY_EXPR} - $2) * 0.5 ASC
        LIMIT 1
      `;

      try {
        const { rows } = await query(sql, baseParams);

        if (rows.length > 0) {
          const s = rows[0];
          const energyValue = parseFloat((s.energy ?? target).toFixed(3));
          usedIds.add(s.id);
          generatedPlaylist.push({
            id: s.id,
            name: s.name,
            artist: s.artist || 'Unknown Artist',
            trackUrl: s.track_url ?? null,
            bpm: s.bpm || 120,
            genre: s.genre || 'Unknown',
            energy: energyValue,
            danceability: s.danceability != null ? parseFloat(s.danceability.toFixed(2)) : null,
            mood_happy: s.mood_happy != null ? parseFloat(s.mood_happy.toFixed(2)) : null,
            mood_relaxed: s.mood_relaxed != null ? parseFloat(s.mood_relaxed.toFixed(2)) : null,
            approachability: s.approachability != null ? parseFloat(s.approachability.toFixed(2)) : null,
            segment: getSegmentLabel(i, energyCurve.length, energyValue),
          });
        }
      } catch (dbError: any) {
        console.error(`[Playlist segment ${i + 1} error]:`, dbError.message);
      }
    }

    if (generatedPlaylist.length === 0) {
      return NextResponse.json(
        { error: "No tracks found. Please upload tracks first." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      meta: {
        totalTracks: generatedPlaylist.length,
        searchMethod: "postgresql_pgvector_hybrid",
        segments: energyCurve.length,
      },
      tracks: generatedPlaylist,
    });

  } catch (error: any) {
    console.error("[Playlist Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
