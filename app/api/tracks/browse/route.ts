import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOptionalInt(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/** youtube.com / youtu.be / music.youtube.com; matches client-side YouTube detection. */
const YOUTUBE_URL_RE = "(youtube\\.com|youtu\\.be)";

function parseMediaParam(raw: string | null): "all" | "youtube" | "audio" {
  const v = raw?.trim().toLowerCase();
  if (v === "youtube" || v === "audio") return v;
  return "all";
}

/**
 * Plain filter on tracks (no vector search).
 * Query params: name, artist, genre (ILIKE), bpmMin, bpmMax, limit (1–200),
 * media: `all` | `youtube` | `audio` (direct http(s) links, e.g. MP3 — not YouTube).
 * Optional: label, key (musical_key), externalId (external_track_id) — ILIKE match.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nameTrim = searchParams.get("name")?.trim();
    const artistTrim = searchParams.get("artist")?.trim();
    const genreTrim = searchParams.get("genre")?.trim();
    const labelTrim = searchParams.get("label")?.trim();
    const keyTrim = searchParams.get("key")?.trim();
    const extTrim = searchParams.get("externalId")?.trim();
    const name = nameTrim ? nameTrim : null;
    const artist = artistTrim ? artistTrim : null;
    const genre = genreTrim ? genreTrim : null;
    const label = labelTrim ? labelTrim : null;
    const musicalKey = keyTrim ? keyTrim : null;
    const externalId = extTrim ? extTrim : null;
    const bpmMin = parseOptionalInt(searchParams.get("bpmMin"));
    const bpmMax = parseOptionalInt(searchParams.get("bpmMax"));
    const limit = parseLimit(searchParams.get("limit"));
    const media = parseMediaParam(searchParams.get("media"));

    const sql = `
      SELECT
        id,
        track_name AS name,
        artist_names[1] AS artist,
        track_url AS "trackUrl",
        genre,
        bpm,
        label,
        musical_key AS "musicalKey",
        external_track_id AS "externalTrackId"
      FROM tracks
      WHERE
        ($1::text IS NULL OR track_name ILIKE '%' || $1 || '%')
        AND (
          $2::text IS NULL
          OR EXISTS (
            SELECT 1
            FROM unnest(COALESCE(artist_names, ARRAY[]::text[])) AS a
            WHERE a ILIKE '%' || $2 || '%'
          )
        )
        AND ($3::text IS NULL OR COALESCE(genre, '') ILIKE '%' || $3 || '%')
        AND ($4::int IS NULL OR (bpm IS NOT NULL AND bpm >= $4))
        AND ($5::int IS NULL OR (bpm IS NOT NULL AND bpm <= $5))
        AND ($8::text IS NULL OR COALESCE(label, '') ILIKE '%' || $8 || '%')
        AND ($9::text IS NULL OR COALESCE(musical_key, '') ILIKE '%' || $9 || '%')
        AND ($10::text IS NULL OR COALESCE(external_track_id, '') ILIKE '%' || $10 || '%')
        AND (
          $7::text = 'all'
          OR (
            $7 = 'youtube'
            AND track_url IS NOT NULL
            AND track_url ~* '${YOUTUBE_URL_RE}'
          )
          OR (
            $7 = 'audio'
            AND track_url IS NOT NULL
            AND track_url !~* '${YOUTUBE_URL_RE}'
            AND track_url ~* '^https?://'
          )
        )
      ORDER BY track_name ASC NULLS LAST
      LIMIT $6
    `;

    const { rows } = await query(sql, [
      name,
      artist,
      genre,
      bpmMin,
      bpmMax,
      limit,
      media,
      label,
      musicalKey,
      externalId,
    ]);

    const tracks = rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: r.name as string,
      artist: (r.artist as string) || "Unknown",
      trackUrl: (r.trackUrl as string | null) ?? null,
      genre: (r.genre as string | null) ?? null,
      bpm: r.bpm != null ? Number(r.bpm) : null,
      label: (r.label as string | null) ?? null,
      musicalKey: (r.musicalKey as string | null) ?? null,
      externalTrackId: (r.externalTrackId as string | null) ?? null,
    }));

    return NextResponse.json({ tracks, count: tracks.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Browse failed";
    console.error("[Browse Error]:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
