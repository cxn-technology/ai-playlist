/**
 * Client-safe helpers for `tracks.track_url` (YouTube watch/embed/shorts or direct audio URL).
 */

export type TrackUrlKind = "youtube" | "audio" | "unknown";

function tryParseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

/**
 * Extracts a YouTube video id from common URL shapes, or null if not YouTube / not parseable.
 */
export function parseYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const u = tryParseUrl(url);
  if (!u) return null;

  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = u.pathname.replace(/^\//, "").split("/")[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const path = u.pathname.replace(/\/$/, "");
    if (path === "/watch") {
      const v = u.searchParams.get("v");
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
    const embed = path.match(/^\/embed\/([\w-]{11})$/);
    if (embed) return embed[1];
    const shorts = path.match(/^\/shorts\/([\w-]{11})$/);
    if (shorts) return shorts[1];
    const live = path.match(/^\/live\/([\w-]{11})$/);
    if (live) return live[1];
  }

  return null;
}

export function classifyTrackUrl(url: string | null | undefined): TrackUrlKind {
  if (!url?.trim()) return "unknown";
  if (parseYouTubeVideoId(url)) return "youtube";
  const u = tryParseUrl(url);
  if (u && (u.protocol === "http:" || u.protocol === "https:")) return "audio";
  return "unknown";
}
