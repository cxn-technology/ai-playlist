"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  SlidersHorizontal,
  ListMusic,
  ChevronRight,
} from "lucide-react";
import { AudioPlayer } from "@/components/audio-player";
import type { DjParsedFilters } from "@/lib/llm/dj-filters";

type RecTrack = {
  id: string;
  name: string;
  artist: string;
  trackUrl: string | null;
  bpm: number | null;
  genre: string | null;
  label: string | null;
  musicalKey: string | null;
  energy: string;
  energyValue: number;
};

function splitList(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function formFromParsed(f: DjParsedFilters) {
  return {
    embedding_narrative: f.embedding_narrative,
    genresStr: f.genres.join(", "),
    bpm_min: f.bpm_min ?? "" as number | "",
    bpm_max: f.bpm_max ?? "" as number | "",
    energy_low: f.energy_low,
    energy_high: f.energy_high,
    prefer_danceable: f.prefer_danceable,
    require_clean: f.require_clean,
    artistsIncStr: f.suggested_artists_include.join(", "),
    artistsExcStr: f.suggested_artists_exclude.join(", "),
    labelsStr: f.suggested_labels.join(", "),
    keysStr: f.musical_keys.join(", "),
    requested_track_count: f.requested_track_count,
    event_summary: f.event_summary,
    mood_tags_str: f.mood_tags.join(", "),
  };
}

type FormState = ReturnType<typeof formFromParsed>;

function formToFilters(f: FormState): Partial<DjParsedFilters> {
  const bpmMin =
    f.bpm_min === "" ? null : Math.round(Number(f.bpm_min));
  const bpmMax =
    f.bpm_max === "" ? null : Math.round(Number(f.bpm_max));
  return {
    embedding_narrative: f.embedding_narrative,
    genres: splitList(f.genresStr),
    bpm_min: bpmMin != null && Number.isFinite(bpmMin) ? bpmMin : null,
    bpm_max: bpmMax != null && Number.isFinite(bpmMax) ? bpmMax : null,
    energy_low: f.energy_low,
    energy_high: f.energy_high,
    prefer_danceable: f.prefer_danceable,
    require_clean: f.require_clean,
    suggested_artists_include: splitList(f.artistsIncStr),
    suggested_artists_exclude: splitList(f.artistsExcStr),
    suggested_labels: splitList(f.labelsStr),
    musical_keys: splitList(f.keysStr),
    requested_track_count: f.requested_track_count,
    event_summary: f.event_summary,
    mood_tags: splitList(f.mood_tags_str),
  };
}

export default function PromptPlaylistPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [promptText, setPromptText] = useState("");
  const [parsed, setParsed] = useState<DjParsedFilters | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [tracks, setTracks] = useState<RecTrack[]>([]);
  const [playingUrl, setPlayingUrl] = useState<{
    url: string | null;
    title: string;
    artist: string;
    bpm: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    setInfo(null);
    if (!promptText.trim()) {
      setError("Enter a prompt first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/prompt-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, previewOnly: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      const pf = data.parsedFilters as DjParsedFilters;
      setParsed(pf);
      setForm(formFromParsed(pf));
      setTracks([]);
      setStep(2);
      if (data.message) setInfo(data.message);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function getRecommendations() {
    if (!form) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const partial = formToFilters(form);
      const res = await fetch("/api/prompt-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            ...partial,
            skipLlm: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setTracks(data.tracks ?? []);
      setParsed(data.parsedFilters ?? null);
      setStep(3);
      if (data.message) setInfo(data.message);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mb-10 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <span className={step >= 1 ? "text-primary" : ""}>1. Prompt</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step >= 2 ? "text-primary" : ""}>2. Filters</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step >= 3 ? "text-primary" : ""}>3. Tracks</span>
        </div>

        <h1 className="mb-2 text-3xl font-black tracking-tight sm:text-4xl">
          Prompt playlist
        </h1>
        <p className="mb-8 max-w-2xl text-slate-400">
          Describe the gig in plain language. We use an LLM to infer genres, BPM, energy, and
          a semantic brief, then rank tracks from your library (30–50 results).
        </p>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {info}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={8}
              placeholder='e.g. "Wedding reception, ages 25–55, feel-good dance, pop R&B and classic party songs, BPM ~100–125, clean only, about 40 tracks."'
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void analyze()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze & preview filters
            </button>
          </div>
        )}

        {step === 2 && form && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Refine filters
              </div>

              <label className="mb-1 block text-xs uppercase text-slate-500">
                Semantic narrative (embedded search)
              </label>
              <textarea
                value={form.embedding_narrative}
                onChange={(e) =>
                  setForm({ ...form, embedding_narrative: e.target.value })
                }
                rows={5}
                className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase text-slate-500">Genres (comma)</label>
                  <input
                    value={form.genresStr}
                    onChange={(e) => setForm({ ...form, genresStr: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase text-slate-500">Mood tags (comma)</label>
                  <input
                    value={form.mood_tags_str}
                    onChange={(e) =>
                      setForm({ ...form, mood_tags_str: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase text-slate-500">BPM min</label>
                  <input
                    type="number"
                    value={form.bpm_min === "" ? "" : form.bpm_min}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bpm_min: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase text-slate-500">BPM max</label>
                  <input
                    type="number"
                    value={form.bpm_max === "" ? "" : form.bpm_max}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bpm_max: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Energy low: {form.energy_low.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={form.energy_low}
                    onChange={(e) =>
                      setForm({ ...form, energy_low: parseFloat(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Energy high: {form.energy_high.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={form.energy_high}
                    onChange={(e) =>
                      setForm({ ...form, energy_high: parseFloat(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.prefer_danceable}
                    onChange={(e) =>
                      setForm({ ...form, prefer_danceable: e.target.checked })
                    }
                  />
                  Prefer danceable tracks
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.require_clean}
                    onChange={(e) =>
                      setForm({ ...form, require_clean: e.target.checked })
                    }
                  />
                  Clean / non-explicit only (needs is_explicit in DB)
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase text-slate-500">
                    Artists include (comma)
                  </label>
                  <input
                    value={form.artistsIncStr}
                    onChange={(e) =>
                      setForm({ ...form, artistsIncStr: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase text-slate-500">
                    Artists exclude (comma)
                  </label>
                  <input
                    value={form.artistsExcStr}
                    onChange={(e) =>
                      setForm({ ...form, artistsExcStr: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase text-slate-500">Labels (comma)</label>
                  <input
                    value={form.labelsStr}
                    onChange={(e) => setForm({ ...form, labelsStr: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase text-slate-500">Keys (comma)</label>
                  <input
                    value={form.keysStr}
                    onChange={(e) => setForm({ ...form, keysStr: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs text-slate-500">
                  Track count: {form.requested_track_count}
                </label>
                <input
                  type="range"
                  min={30}
                  max={50}
                  value={form.requested_track_count}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requested_track_count: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full max-w-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void getRecommendations()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ListMusic className="h-4 w-4" />
                )}
                Get recommendations
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold"
              >
                Edit filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setTracks([]);
                  setParsed(null);
                  setForm(null);
                }}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold"
              >
                New prompt
              </button>
            </div>

            <p className="text-sm text-slate-400">
              {tracks.length} track{tracks.length === 1 ? "" : "s"}
              {parsed && (
                <span className="ml-2 text-slate-500">
                  · {parsed.event_summary.slice(0, 120)}
                  {parsed.event_summary.length > 120 ? "…" : ""}
                </span>
              )}
            </p>

            <ul className="grid gap-3 sm:grid-cols-2">
              {tracks.map((t) => (
                <li
                  key={t.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="text-sm text-slate-400">{t.artist}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {t.bpm != null && <span>{t.bpm} BPM</span>}
                    <span>{t.energy}</span>
                    {t.genre && <span>{t.genre}</span>}
                    {t.label && <span>{t.label}</span>}
                    {t.musicalKey && <span>{t.musicalKey}</span>}
                  </div>
                  {t.trackUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPlayingUrl({
                          url: t.trackUrl,
                          title: t.name,
                          artist: t.artist,
                          bpm: t.bpm,
                        })
                      }
                      className="mt-3 text-xs font-bold uppercase tracking-wide text-primary hover:underline"
                    >
                      Play preview
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {tracks.length === 0 && (
              <p className="text-slate-500">No tracks returned. Widen filters or add music to the library.</p>
            )}
          </div>
        )}
      </div>

      {playingUrl && (
        <AudioPlayer
          title={playingUrl.title}
          artist={playingUrl.artist}
          bpm={playingUrl.bpm}
          trackUrl={playingUrl.url}
          className="fixed bottom-4 right-4 z-50 w-[min(100vw-2rem,380px)] shadow-2xl"
          onClose={() => setPlayingUrl(null)}
        />
      )}
    </div>
  );
}
