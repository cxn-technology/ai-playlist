import { NextResponse } from 'next/server';
import { embedTextToVectorLiteral, embedTextsBatchToVectorLiterals } from '@/lib/server/embedder';
import { parseZipdjPrompt } from '@/lib/llm/parseZipdjPrompt';
import { runZipdjWebSearchWithAiSdk } from '@/lib/server/zipdjAiSdkWebSearch';
import {
  pickBestZipdjNeighborForWebCandidate,
  vectorSearchZipdj,
  zipdjWebCandidateLexicalScore,
  type ZipdjRow,
} from '@/lib/server/matchZipdjCatalog';
import { buildZipdjEmbeddingText } from '@/lib/server/zipdjEmbedding';
import { computeTemporalContext } from '@/lib/server/zipdjTemporalContext';

export const maxDuration = 120;

function serializeTrack(
  r: ZipdjRow,
  source: 'web' | 'vector',
  vecDist?: number
) {
  return {
    trackId: r.track_id,
    releaseName: r.release_name,
    trackName: r.track_name,
    trackUrl: r.track_url,
    artistsName: r.artists_name,
    genre: r.genre,
    tags: r.tags,
    labelName: r.label_name,
    labelId: r.label_id,
    releaseId: r.release_id,
    trackCreatedDate: r.track_created_date,
    releaseCreatedDate: r.release_created_date,
    source,
    vecDist: vecDist != null ? Number(vecDist.toFixed(6)) : undefined,
  };
}

/** Same embedding layout as CSV ingest (`buildZipdjEmbeddingText`) so NN search matches catalog space. */
function candidateToEmbedQuery(title: string, artist: string | null): string {
  return buildZipdjEmbeddingText({
    release_name: title.trim(),
    track_name: '',
    artists_name: artist?.trim() || null,
    genre: null,
    tags: null,
    label_name: null,
    label_id: null,
    release_id: null,
    track_created_date: null,
    release_created_date: null,
  });
}

/** Newer catalog rows win ties after vector distance. */
function catalogRecencyTs(row: ZipdjRow): number {
  const s = row.release_created_date || row.track_created_date;
  if (!s?.trim()) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

const WEB_OVERFETCH = 3;
const WEB_FETCH_CAP = 150;
/** Wider pool than 1-NN — correct row is often not the single closest cosine when query text drifts. */
const WEB_VECTOR_NEIGHBOR_K = 28;
const VECTOR_SEARCH_CONCURRENCY = 12;

type WebVectorHit = ZipdjRow & { vec_dist: number; web_lex: number };

async function batchWebCandidateVectorHits(
  items: { title: string; artist: string | null; vector: string }[]
): Promise<WebVectorHit[]> {
  const out: WebVectorHit[] = [];
  for (let i = 0; i < items.length; i += VECTOR_SEARCH_CONCURRENCY) {
    const slice = items.slice(i, i + VECTOR_SEARCH_CONCURRENCY);
    const batch = await Promise.all(
      slice.map((it) => vectorSearchZipdj(it.vector, WEB_VECTOR_NEIGHBOR_K))
    );
    for (let j = 0; j < slice.length; j++) {
      const { title, artist } = slice[j]!;
      const near = batch[j]!;
      const hit = pickBestZipdjNeighborForWebCandidate(title, artist, near);
      if (hit) {
        out.push({
          ...hit,
          web_lex: zipdjWebCandidateLexicalScore(title, artist, hit),
        });
      }
    }
  }
  return out;
}

/** Dedupe by track_id, then rank by lexical title/artist lock-in, then distance, then recency. */
function rankWebCatalogHits(hits: WebVectorHit[], take: number): { row: ZipdjRow; vecDist: number }[] {
  const best = new Map<string, WebVectorHit>();
  for (const h of hits) {
    const cur = best.get(h.track_id);
    if (!cur) best.set(h.track_id, h);
    else if (h.web_lex > cur.web_lex) best.set(h.track_id, h);
    else if (h.web_lex === cur.web_lex && h.vec_dist < cur.vec_dist) best.set(h.track_id, h);
  }
  const ranked = [...best.values()].sort((a, b) => {
    if (b.web_lex !== a.web_lex) return b.web_lex - a.web_lex;
    if (a.vec_dist !== b.vec_dist) return a.vec_dist - b.vec_dist;
    return catalogRecencyTs(b) - catalogRecencyTs(a);
  });
  return ranked.slice(0, take).map((h) => {
    const { vec_dist: vecDist, web_lex: _wl, ...row } = h;
    return { row: row as ZipdjRow, vecDist };
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const parsed = await parseZipdjPrompt(prompt);
    const queryVector = await embedTextToVectorLiteral(parsed.embedding_narrative);
    const cap = parsed.requested_count;
    const poolSize = Math.min(Math.max(cap * 4, cap), 200);

    let notice: string | undefined;
    /** Legacy field: always null (Tavily removed). */
    const tavilyResponse: null = null;
    let webExtractedCandidates: { title: string; artist: string | null }[] | null = null;
    let aiSdkWeb: {
      output: { tracks: { title: string; artist: string | null }[]; rationale: string };
      sources: unknown;
      text: string;
      stepCount: number;
    } | null = null;

    const vectorHits = await vectorSearchZipdj(queryVector, poolSize);

    if (parsed.mode === 'semantic_only') {
      const sliced = vectorHits.slice(0, cap);
      return NextResponse.json({
        parsed,
        tracks: sliced.map((r) => serializeTrack(r, 'vector', r.vec_dist)),
        message:
          sliced.length === 0
            ? 'No rows in zipdj_tracks_ai. Ingest a CSV first.'
            : undefined,
        tavilyResponse,
        webExtractedCandidates: null,
        aiSdkWeb: null,
      });
    }

    let webPairs: { row: ZipdjRow; vecDist: number }[] = [];

    try {
      const q = parsed.web_query?.trim();
      if (!q) {
        notice = 'No web query from router; using catalog similarity only.';
      } else {
        const webFetchCount = Math.min(cap * WEB_OVERFETCH, WEB_FETCH_CAP);
        const temporalContext = computeTemporalContext(prompt);
        const ai = await runZipdjWebSearchWithAiSdk({
          originalPrompt: prompt,
          webQuery: q,
          maxTracks: webFetchCount,
          temporalContext,
        });
        aiSdkWeb = {
          output: ai.output,
          sources: ai.sources,
          text: ai.text,
          stepCount: ai.stepCount,
        };
        webExtractedCandidates = ai.output.tracks.map((t) => ({
          title: t.title,
          artist: t.artist,
        }));

        const titles = ai.output.tracks;
        if (titles.length > 0) {
          const embedTexts = titles.map((t) => candidateToEmbedQuery(t.title, t.artist));
          const vectors = await embedTextsBatchToVectorLiterals(embedTexts);
          const items = titles.map((t, idx) => ({
            title: t.title,
            artist: t.artist,
            vector: vectors[idx]!,
          }));
          const rawHits = await batchWebCandidateVectorHits(items);
          webPairs = rankWebCatalogHits(rawHits, cap);
        }
      }
    } catch (e) {
      console.error('[zipdj/prompt] AI SDK web pipeline:', e);
      notice =
        e instanceof Error
          ? `Web search (OpenAI Responses + AI SDK) failed: ${e.message}. Showing catalog matches only.`
          : 'Web search failed; showing catalog matches only.';
    }

    const merged: ReturnType<typeof serializeTrack>[] = [];
    const seen = new Set<string>();

    for (const { row: r, vecDist } of webPairs) {
      if (merged.length >= cap) break;
      if (seen.has(r.track_id)) continue;
      seen.add(r.track_id);
      merged.push(serializeTrack(r, 'web', vecDist));
    }

    for (const r of vectorHits) {
      if (merged.length >= cap) break;
      if (seen.has(r.track_id)) continue;
      seen.add(r.track_id);
      merged.push(serializeTrack(r, 'vector', r.vec_dist));
    }

    return NextResponse.json({
      parsed,
      tracks: merged,
      message: notice,
      tavilyResponse,
      webExtractedCandidates,
      aiSdkWeb,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ZipDJ prompt failed';
    console.error('[zipdj/prompt]', e);
    if (msg.includes('OPENAI_API_KEY')) {
      return NextResponse.json({ error: msg }, { status: 501 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
