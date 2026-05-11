import { NextResponse } from 'next/server';
import { embedTextToVectorLiteral } from '@/lib/server/embedder';
import {
  browseZipdjFiltered,
  countZipdjFiltered,
  vectorSearchZipdjFiltered,
  type ZipdjCatalogFilters,
  type ZipdjRow,
} from '@/lib/server/matchZipdjCatalog';

export const maxDuration = 120;

const PAGE_SIZE = 50;
const MAX_PAGE = 2000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function trimOrNull(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function parseReleaseDate(raw: string | null): string | null {
  const t = trimOrNull(raw);
  if (!t) return null;
  if (!ISO_DATE.test(t)) return null;
  return t;
}

function parsePage(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

function serializeTrack(r: ZipdjRow, vecDist?: number) {
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
    vecDist: vecDist != null ? Number(vecDist.toFixed(6)) : undefined,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = trimOrNull(searchParams.get('q'));
    const page = parsePage(searchParams.get('page'));
    const offset = (page - 1) * PAGE_SIZE;

    const filters: ZipdjCatalogFilters = {
      artist: trimOrNull(searchParams.get('artist')),
      label: trimOrNull(searchParams.get('label')),
      genre: trimOrNull(searchParams.get('genre')),
      releaseDateFrom: parseReleaseDate(searchParams.get('releaseDateFrom')),
      releaseDateTo: parseReleaseDate(searchParams.get('releaseDateTo')),
    };

    const total = await countZipdjFiltered(filters);

    if (!q) {
      const rows = await browseZipdjFiltered(filters, PAGE_SIZE, offset);
      return NextResponse.json({
        mode: 'browse' as const,
        page,
        pageSize: PAGE_SIZE,
        total,
        tracks: rows.map((r) => serializeTrack(r)),
      });
    }

    const vectorLiteral = await embedTextToVectorLiteral(q);
    const rows = await vectorSearchZipdjFiltered(vectorLiteral, filters, PAGE_SIZE, offset);
    return NextResponse.json({
      mode: 'vector' as const,
      page,
      pageSize: PAGE_SIZE,
      total,
      tracks: rows.map((r) => serializeTrack(r, r.vec_dist)),
    });
  } catch (e) {
    console.error('[zipdj/catalog-search]', e);
    const message = e instanceof Error ? e.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
