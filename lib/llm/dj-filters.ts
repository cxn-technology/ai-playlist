export type DjParsedFilters = {
  event_summary: string;
  genres: string[];
  bpm_min: number | null;
  bpm_max: number | null;
  energy_low: number;
  energy_high: number;
  prefer_danceable: boolean;
  mood_tags: string[];
  require_clean: boolean;
  suggested_artists_include: string[];
  suggested_artists_exclude: string[];
  suggested_labels: string[];
  musical_keys: string[];
  embedding_narrative: string;
  requested_track_count: number;
};

export type DjClientFilterInput = Partial<DjParsedFilters> & {
  skipLlm?: boolean;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function normalizeParsedFilters(raw: Partial<DjParsedFilters>): DjParsedFilters {
  const energy_low = clamp(
    typeof raw.energy_low === 'number' ? raw.energy_low : 0.45,
    0,
    1
  );
  const energy_high = clamp(
    typeof raw.energy_high === 'number' ? raw.energy_high : 0.75,
    0,
    1
  );
  const lo = Math.min(energy_low, energy_high);
  const hi = Math.max(energy_low, energy_high);

  let bpm_min = parseNumberOrNull(raw.bpm_min);
  let bpm_max = parseNumberOrNull(raw.bpm_max);
  if (bpm_min != null && bpm_max != null && bpm_min > bpm_max) {
    [bpm_min, bpm_max] = [bpm_max, bpm_min];
  }

  const requested = Math.round(
    typeof raw.requested_track_count === 'number' ? raw.requested_track_count : 40
  );

  return {
    event_summary:
      typeof raw.event_summary === 'string' ? raw.event_summary : 'DJ music selection',
    genres: normalizeStringArray(raw.genres),
    bpm_min,
    bpm_max,
    energy_low: lo,
    energy_high: hi,
    prefer_danceable: Boolean(raw.prefer_danceable),
    mood_tags: normalizeStringArray(raw.mood_tags),
    require_clean: Boolean(raw.require_clean),
    suggested_artists_include: normalizeStringArray(raw.suggested_artists_include),
    suggested_artists_exclude: normalizeStringArray(raw.suggested_artists_exclude),
    suggested_labels: normalizeStringArray(raw.suggested_labels),
    musical_keys: normalizeStringArray(raw.musical_keys),
    embedding_narrative:
      typeof raw.embedding_narrative === 'string' && raw.embedding_narrative.trim()
        ? raw.embedding_narrative.trim()
        : 'Feel-good dance music for a mixed crowd, medium to high energy.',
    requested_track_count: clamp(requested, 30, 50),
  };
}

export function mergeDjFilters(
  base: DjParsedFilters,
  override?: DjClientFilterInput | null
): DjParsedFilters {
  if (!override) return base;
  const o = override;
  const pick = <K extends keyof DjParsedFilters>(key: K): DjParsedFilters[K] => {
    if (key in o && o[key] !== undefined) {
      return o[key] as DjParsedFilters[K];
    }
    return base[key];
  };

  const merged = {
    event_summary: pick('event_summary'),
    genres: pick('genres'),
    bpm_min: pick('bpm_min'),
    bpm_max: pick('bpm_max'),
    energy_low: pick('energy_low'),
    energy_high: pick('energy_high'),
    prefer_danceable: pick('prefer_danceable'),
    mood_tags: pick('mood_tags'),
    require_clean: pick('require_clean'),
    suggested_artists_include: pick('suggested_artists_include'),
    suggested_artists_exclude: pick('suggested_artists_exclude'),
    suggested_labels: pick('suggested_labels'),
    musical_keys: pick('musical_keys'),
    embedding_narrative: pick('embedding_narrative'),
    requested_track_count: pick('requested_track_count'),
  };
  return normalizeParsedFilters(merged);
}
