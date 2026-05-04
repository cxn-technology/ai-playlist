import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if track exists and get its embedding/attributes
    const trackRes = await query(`
      SELECT 
        embedding, 
        track_name, 
        artist_names,
        track_url,
        COALESCE(aggressiveness, 0.5) AS aggressiveness,
        COALESCE(mood_sad, 0.5) AS mood_sad,
        COALESCE(mood_happy, 0.5) AS mood_happy,
        COALESCE(mood_relaxed, 0.5) AS mood_relaxed
      FROM tracks WHERE id = $1
    `, [id]);

    if (trackRes.rows.length === 0) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const t = trackRes.rows[0];
    const { embedding, track_name, artist_names } = t;
    const avg = parseFloat(t.aggressiveness);
    const sad = parseFloat(t.mood_sad);
    const happy = parseFloat(t.mood_happy);
    
    // Determine the 'Type' (Energy Bucket)
    let energyClause = '';
    if (avg < 0.35) {
      energyClause = 'AND aggressiveness < 0.35'; // Chill
    } else if (avg > 0.65) {
      energyClause = 'AND aggressiveness > 0.65'; // High Energy
    } else {
      energyClause = 'AND aggressiveness >= 0.35 AND aggressiveness <= 0.65'; // Steady
    }

    // Determine dominant Mood if very strong
    let moodClause = '';
    if (sad > 0.6) {
      moodClause = 'AND mood_sad > 0.4';
    } else if (happy > 0.6) {
      moodClause = 'AND mood_happy > 0.4';
    }

    // Find similar tracks using vector similarity but restricted to the 'type'
    const sql = `
      SELECT
        id,
        track_name AS name,
        artist_names[1] AS artist,
        track_url,
        bpm,
        COALESCE(aggressiveness, 0.5) AS energy,
        COALESCE(mood_sad, 0.5) AS mood_sad,
        COALESCE(mood_happy, 0.5) AS mood_happy
      FROM tracks
      WHERE id != $1 
      ${energyClause}
      ${moodClause}
      ORDER BY embedding <-> $2
      LIMIT 10
    `;

    const { rows } = await query(sql, [id, embedding]);

    // If we have fewer than 3 results with strict filters, fallback to just energy bucket
    let finalRows = rows;
    if (rows.length < 3 && moodClause !== '') {
       const fallbackSql = `
        SELECT
          id,
          track_name AS name,
          artist_names[1] AS artist,
          track_url,
          bpm,
          COALESCE(aggressiveness, 0.5) AS energy,
          COALESCE(mood_sad, 0.5) AS mood_sad,
          COALESCE(mood_happy, 0.5) AS mood_happy
        FROM tracks
        WHERE id != $1 
        ${energyClause}
        ORDER BY embedding <-> $2
        LIMIT 10
      `;
      const fallbackRes = await query(fallbackSql, [id, embedding]);
      finalRows = fallbackRes.rows;
    }

    const relatedTracks = finalRows.map(r => {
      const e = parseFloat(r.energy);
      return {
        id: r.id,
        name: r.name,
        artist: r.artist || 'Unknown',
        trackUrl: r.track_url ?? null,
        bpm: r.bpm,
        energy: e < 0.35 ? "Chill" : e > 0.65 ? "High Energy" : "Steady",
        energyValue: e,
        mood_sad: parseFloat(r.mood_sad),
        mood_happy: parseFloat(r.mood_happy)
      };
    });

    return NextResponse.json({ 
      originalTrack: { 
        id, 
        name: track_name, 
        artist: artist_names[0],
        trackUrl: t.track_url ?? null,
        energy: avg < 0.35 ? "Chill" : avg > 0.65 ? "High Energy" : "Steady",
        mood_sad: sad,
        mood_happy: happy
      },
      relatedTracks 
    });

  } catch (error: any) {
    console.error("[Related Tracks Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
