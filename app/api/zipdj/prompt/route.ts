import { NextResponse } from 'next/server';
import { embedTextToVectorLiteral } from '@/lib/server/embedder';
import { parseZipdjPrompt } from '@/lib/llm/parseZipdjPrompt';
import { runZipdjWebSearchWithAiSdk } from '@/lib/server/zipdjAiSdkWebSearch';
import { vectorSearchZipdj, type ZipdjRow } from '@/lib/server/matchZipdjCatalog';
import { matchWebTrackTitlesToZipdjCatalog } from '@/lib/server/zipdjWebCatalogMatch';
import { computeTemporalContext } from '@/lib/server/zipdjTemporalContext';

/** Allow long OpenAI + web_search runs (local dev / self-hosted). */
export const maxDuration = 600;

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

const WEB_OVERFETCH = 3;
const WEB_FETCH_CAP = 150;

function nowMs() {
  return performance.now();
}

export async function POST(req: Request) {
  const t0 = nowMs();
  const timingsMs: Record<string, number> = {};
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    let t = nowMs();
    const parsed = await parseZipdjPrompt(prompt);
    timingsMs.parseZipdjPrompt = Math.round(nowMs() - t);

    t = nowMs();
    const queryVector = await embedTextToVectorLiteral(parsed.embedding_narrative);
    timingsMs.embedNarrative = Math.round(nowMs() - t);

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

    t = nowMs();
    const vectorHits = await vectorSearchZipdj(queryVector, poolSize);
    timingsMs.vectorPoolSearch = Math.round(nowMs() - t);

    if (parsed.mode === 'semantic_only') {
      const sliced = vectorHits.slice(0, cap);
      timingsMs.total = Math.round(nowMs() - t0);
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
        timingsMs,
        timingMeta: { poolSize, cap, mode: 'semantic_only' as const },
      });
    }

    let webPairs: { row: ZipdjRow; vecDist: number }[] = [];

    let webFetchCount = 0;
    let catalogMatchInputCount = 0;
    try {
      const q = parsed.web_query?.trim();
      if (!q) {
        notice = 'No web query from router; using catalog similarity only.';
      } else {
        webFetchCount = Math.min(cap * WEB_OVERFETCH, WEB_FETCH_CAP);
        const temporalContext = computeTemporalContext(prompt);
        t = nowMs();
        const ai = await runZipdjWebSearchWithAiSdk({
          originalPrompt: prompt,
          webQuery: q,
          maxTracks: webFetchCount,
          temporalContext,
        });
        timingsMs.runZipdjWebSearchWithAiSdk = Math.round(nowMs() - t);
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
        catalogMatchInputCount = titles.length;
        if (titles.length > 0) {
          t = nowMs();
          webPairs = await matchWebTrackTitlesToZipdjCatalog(
            titles.map((t) => ({ title: t.title, artist: t.artist })),
            cap
          );
          timingsMs.matchWebTrackTitlesToZipdjCatalog = Math.round(nowMs() - t);
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

    timingsMs.total = Math.round(nowMs() - t0);

    return NextResponse.json({
      parsed,
      tracks: merged,
      message: notice,
      tavilyResponse,
      webExtractedCandidates,
      aiSdkWeb,
      timingsMs,
      timingMeta: {
        poolSize,
        cap,
        webFetchCount,
        catalogMatchInputCount,
        mode: 'web_then_match' as const,
      },
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
