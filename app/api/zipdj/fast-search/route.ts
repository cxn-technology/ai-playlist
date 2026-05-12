import { NextResponse } from 'next/server';

/** Upstream fast search + catalog match (SerpAPI → formatter → pgvector). */
const DEFAULT_BASE = 'http://127.0.0.1:4004';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const base = (process.env.ZIPDJ_SEARCH_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
    const url = `${base}/api/search`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const text = await upstream.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { error: 'Upstream returned non-JSON', raw: text.slice(0, 2000) },
        { status: 502 }
      );
    }

    if (!upstream.ok) {
      const err =
        typeof data === 'object' && data !== null && 'error' in data
          ? (data as { error: string }).error
          : text || upstream.statusText;
      return NextResponse.json({ error: err }, { status: upstream.status >= 400 ? upstream.status : 502 });
    }

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fast-search proxy failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
