import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "0.0.0.0" || h === "[::1]" || h === "::1") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = h.match(ipv4);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/**
 * Streams remote audio through the app origin so WaveSurfer is not blocked by CORS.
 * Forwards `Range` when present (seeking / partial fetch).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw?.trim()) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw.trim());
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs allowed" }, { status: 400 });
  }

  if (isForbiddenHost(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  const range = request.headers.get("range");
  const upstreamHeaders: HeadersInit = {
    "User-Agent": "zipdj-audio-proxy/1.0",
  };
  if (range) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: upstreamHeaders,
      redirect: "follow",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: 502 }
    );
  }

  const out = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) out.set("Content-Type", ct);
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) out.set("Accept-Ranges", acceptRanges);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) out.set("Content-Range", contentRange);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) out.set("Content-Length", contentLength);
  out.set("Cache-Control", "public, max-age=300");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
