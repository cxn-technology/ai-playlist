"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Headphones,
  Link2,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Youtube,
} from "lucide-react";

import RelatedSongsSheet from "@/components/RelatedSongsSheet";
import type { RelatedSheetTrack } from "@/components/related-songs-sheet-types";
import { AudioPlayer } from "@/components/audio-player";
import { classifyTrackUrl } from "@/lib/shared/track-url";

type BrowseTrack = {
  id: string;
  name: string;
  artist: string;
  trackUrl: string | null;
  genre: string | null;
  bpm: number | null;
  label?: string | null;
  musicalKey?: string | null;
  externalTrackId?: string | null;
};

function browseTrackToSheetSeed(t: BrowseTrack): RelatedSheetTrack {
  return {
    id: t.id,
    name: t.name,
    artist: t.artist,
    trackUrl: t.trackUrl,
    bpm: t.bpm ?? undefined,
    energy: "Steady",
    energyValue: 0.5,
  };
}

function sheetToBrowsePlaying(t: RelatedSheetTrack): BrowseTrack {
  return {
    id: t.id,
    name: t.name,
    artist: t.artist,
    trackUrl: t.trackUrl ?? null,
    genre: null,
    bpm: typeof t.bpm === "number" && Number.isFinite(t.bpm) ? t.bpm : null,
    label: null,
    musicalKey: null,
    externalTrackId: null,
  };
}

type MediaFilter = "all" | "youtube" | "audio";

const MEDIA_OPTIONS: { value: MediaFilter; label: string; hint: string }[] = [
  { value: "all", label: "All sources", hint: "Any preview URL" },
  { value: "youtube", label: "YouTube", hint: "Watch / embed links" },
  { value: "audio", label: "Direct audio", hint: "MP3 & hosted files" },
];

export default function BrowseTracksPage() {
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [externalIdFilter, setExternalIdFilter] = useState("");
  const [media, setMedia] = useState<MediaFilter>("all");

  const [tracks, setTracks] = useState<BrowseTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingTrack, setPlayingTrack] = useState<BrowseTrack | null>(null);
  const [sheetTrack, setSheetTrack] = useState<BrowseTrack | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.set("name", name.trim());
      if (artist.trim()) params.set("artist", artist.trim());
      if (genre.trim()) params.set("genre", genre.trim());
      if (bpmMin.trim()) params.set("bpmMin", bpmMin.trim());
      if (bpmMax.trim()) params.set("bpmMax", bpmMax.trim());
      if (labelFilter.trim()) params.set("label", labelFilter.trim());
      if (keyFilter.trim()) params.set("key", keyFilter.trim());
      if (externalIdFilter.trim()) params.set("externalId", externalIdFilter.trim());
      if (media !== "all") params.set("media", media);

      const res = await fetch(`/api/tracks/browse?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setTracks(data.tracks ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, [name, artist, genre, bpmMin, bpmMax, labelFilter, keyFilter, externalIdFilter, media]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchTracks();
    }, 300);
    return () => clearTimeout(t);
  }, [fetchTracks]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060814] text-slate-200">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[20%] top-0 h-[min(70vh,520px)] w-[min(70vw,520px)] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.14),transparent_65%)] blur-2xl" />
        <div className="absolute -right-[15%] bottom-[10%] h-[min(50vh,420px)] w-[min(55vw,420px)] rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1),transparent_65%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,20,0.3)_0%,rgba(6,8,20,0.92)_45%,#060814_100%)]" />
      </div>

      <div className="relative mx-auto flex max-w-2xl flex-col gap-10 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
            <div className="mt-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                <Headphones className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Track library</h1>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              Search by name, artist, genre, or BPM. Filter by where your preview lives — YouTube or a direct audio
              link.
            </p>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 sm:pt-1">
            Metadata-first browse
          </p>
        </header>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 p-1 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="rounded-[0.9rem] border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-primary/80" />
                Preview source
              </div>
              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Filter by preview source"
              >
                {MEDIA_OPTIONS.map((opt) => {
                  const active = media === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMedia(opt.value)}
                      className={`group flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-all ${
                        active
                          ? "border-primary/45 bg-primary/15 text-white shadow-[0_0_0_1px_rgba(0,87,193,0.45)]"
                          : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {opt.value === "youtube" ? (
                          <Youtube className="h-4 w-4 shrink-0 opacity-90" />
                        ) : opt.value === "audio" ? (
                          <Link2 className="h-4 w-4 shrink-0 opacity-90" />
                        ) : (
                          <Headphones className="h-4 w-4 shrink-0 opacity-90" />
                        )}
                        {opt.label}
                      </span>
                      <span className="text-[11px] leading-snug text-slate-500 group-hover:text-slate-400">
                        {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                  Track name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contains…"
                    className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                  Artist
                  <input
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Any listed artist…"
                    className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                  Genre
                  <input
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Contains…"
                    className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                    BPM min
                    <input
                      inputMode="numeric"
                      value={bpmMin}
                      onChange={(e) => setBpmMin(e.target.value.replace(/\D/g, ""))}
                      placeholder="—"
                      className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                    BPM max
                    <input
                      inputMode="numeric"
                      value={bpmMax}
                      onChange={(e) => setBpmMax(e.target.value.replace(/\D/g, ""))}
                      placeholder="—"
                      className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                  Label
                  <input
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value)}
                    placeholder="Contains…"
                    className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                  Musical key
                  <input
                    value={keyFilter}
                    onChange={(e) => setKeyFilter(e.target.value)}
                    placeholder="Contains…"
                    className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
                <label className="sm:col-span-2 flex flex-col gap-1.5 text-xs font-medium text-slate-400">
                  External track ID
                  <input
                    value={externalIdFilter}
                    onChange={(e) => setExternalIdFilter(e.target.value)}
                    placeholder="Catalog / CSV id…"
                    className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition-colors focus:border-primary/45 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
              </div>
              <p className="mt-4 text-[11px] text-slate-500">
                Results update shortly after you change filters. Sorted A–Z by track title.
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-sm font-medium text-slate-400">
              {loading ? "Loading…" : `${tracks.length} track${tracks.length === 1 ? "" : "s"}`}
            </span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
          </div>

          {!loading && tracks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
              <p className="text-sm text-slate-500">Nothing matches your filters.</p>
              <p className="mt-2 text-xs text-slate-600">Try another source or clear text filters.</p>
            </div>
          ) : null}

          <ul className="flex flex-col gap-2">
            {tracks.map((track) => {
              const kind = classifyTrackUrl(track.trackUrl);
              return (
                <li
                  key={track.id}
                  className={`flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
                    playingTrack?.id === track.id
                      ? "border-primary/35 bg-primary/10 ring-1 ring-primary/25"
                      : "border-white/[0.07] bg-slate-950/50 hover:border-white/12 hover:bg-slate-900/60"
                  }`}
                >
                  <button
                    type="button"
                    title={track.trackUrl ? "Play or pause preview" : "No preview URL"}
                    disabled={!track.trackUrl}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!track.trackUrl) return;
                      setPlayingTrack((prev) => (prev?.id === track.id ? null : track));
                    }}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
                      track.trackUrl
                        ? "border-white/12 bg-black/50 text-primary shadow-inner hover:border-primary/40 hover:bg-primary/10"
                        : "cursor-not-allowed border-white/[0.06] bg-black/30 text-slate-600"
                    }`}
                  >
                    {playingTrack?.id === track.id ? (
                      <Pause className="h-4 w-4" aria-hidden />
                    ) : (
                      <Play className="ml-0.5 h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => {
                      setSheetTrack(track);
                      setIsSheetOpen(true);
                    }}
                  >
                  <div className="min-w-0 w-full">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-white">{track.name}</p>
                      {kind === "youtube" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300/95">
                          <Youtube className="h-3 w-3" aria-hidden />
                          YouTube
                        </span>
                      ) : kind === "audio" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/95">
                          <Link2 className="h-3 w-3" aria-hidden />
                          Audio
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          No URL
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400">{track.artist}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {track.genre ? (
                        <span className="rounded-md border border-white/8 bg-black/30 px-2 py-0.5">{track.genre}</span>
                      ) : null}
                      {track.bpm != null ? (
                        <span className="rounded-md border border-white/8 bg-black/30 px-2 py-0.5 tabular-nums">
                          {track.bpm} BPM
                        </span>
                      ) : null}
                      {track.label ? (
                        <span className="rounded-md border border-white/8 bg-black/30 px-2 py-0.5">{track.label}</span>
                      ) : null}
                      {track.musicalKey ? (
                        <span className="rounded-md border border-white/8 bg-black/30 px-2 py-0.5">{track.musicalKey}</span>
                      ) : null}
                    </div>
                  </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <RelatedSongsSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        selectedTrack={sheetTrack ? browseTrackToSheetSeed(sheetTrack) : null}
        playingTrackId={playingTrack?.id ?? null}
        onPlayTrack={(t) => {
          setPlayingTrack((prev) => (prev?.id === t.id ? null : sheetToBrowsePlaying(t)));
        }}
      />

      {playingTrack ? (
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="mx-auto max-w-2xl pointer-events-auto">
            <AudioPlayer
              key={playingTrack.id}
              title={playingTrack.name}
              artist={playingTrack.artist}
              bpm={playingTrack.bpm}
              trackUrl={playingTrack.trackUrl}
              onClose={() => setPlayingTrack(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
