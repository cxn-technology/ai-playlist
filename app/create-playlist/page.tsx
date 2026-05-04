"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Building2,
  Download,
  Dumbbell,
  Headphones,
  Home,
  Landmark,
  Link2,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Sofa,
  Sparkles,
  Tent,
  UserRound,
  Users,
  Wine,
  Youtube,
} from "lucide-react";

import RelatedSongsSheet from "@/components/RelatedSongsSheet";
import type { RelatedSheetTrack } from "@/components/related-songs-sheet-types";
import { AudioPlayer } from "@/components/audio-player";
import { classifyTrackUrl } from "@/lib/shared/track-url";

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_ICONS = {
  club: Wine,
  "house-party": Home,
  lounge: Sofa,
  festival: Tent,
  workout: Dumbbell,
  focus: Headphones,
} satisfies Record<string, LucideIcon>;

const EVENT_TYPES = [
  { id: "club" as const, label: "Club Night" },
  { id: "house-party" as const, label: "House Party" },
  { id: "lounge" as const, label: "Lounge / Bar" },
  { id: "festival" as const, label: "Festival" },
  { id: "workout" as const, label: "Workout" },
  { id: "focus" as const, label: "Focus / Chill" },
];

const VENUE_SIZES: {
  id: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
}[] = [
  { id: "intimate", label: "Intimate", sub: "< 50", Icon: UserRound },
  { id: "medium", label: "Medium", sub: "50–200", Icon: Users },
  { id: "large", label: "Large Room", sub: "200–500", Icon: Building2 },
  { id: "massive", label: "Massive", sub: "500+", Icon: Landmark },
];

const GENRES = [
  "electronic",
  "techno",
  "tech house",
  "deep house",
  "trance",
  "hip hop",
  "pop",
  "r&b",
  "ambient",
  "drum and bass",
  "dubstep",
  "chillout",
  "disco",
  "funk",
  "lo-fi",
];

const ENERGY_FLOWS = [
  { id: "build-up" as const, label: "Build-Up", desc: "Starts chill, climbs to peak." },
  { id: "peak-valley" as const, label: "Peak-Valley", desc: "High energy waves with deep drops." },
  { id: "steady" as const, label: "Steady", desc: "Consistent energy throughout." },
];

type PlaylistTrack = {
  id: string;
  name: string;
  artist: string;
  trackUrl?: string | null;
  bpm: number;
  genre: string;
  energy: number;
  segment: string;
  danceability?: number | null;
  mood_happy?: number | null;
  mood_relaxed?: number | null;
  approachability?: number | null;
};

function playlistTrackToSheet(t: PlaylistTrack): RelatedSheetTrack {
  return {
    id: t.id,
    name: t.name,
    artist: t.artist,
    trackUrl: t.trackUrl ?? null,
    bpm: t.bpm,
    energy: "Steady",
    energyValue: typeof t.energy === "number" && Number.isFinite(t.energy) ? t.energy : 0.5,
    mood_happy: t.mood_happy ?? undefined,
  };
}

function sheetToPlaylistPlaying(t: RelatedSheetTrack): PlaylistTrack {
  return {
    id: t.id,
    name: t.name,
    artist: t.artist,
    trackUrl: t.trackUrl ?? null,
    bpm: typeof t.bpm === "number" && Number.isFinite(t.bpm) ? t.bpm : 120,
    genre: "Unknown",
    energy: typeof t.energyValue === "number" ? t.energyValue : 0.5,
    segment: "—",
  };
}

function cardShell(children: ReactNode) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 p-1 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="rounded-[0.9rem] border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-5 sm:p-6">
        {children}
      </div>
    </div>
  );
}

function sectionLabel(icon: ReactNode, text: string) {
  return (
    <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {icon}
      {text}
    </div>
  );
}

function EnergyCurveSvg({ type, active }: { type: string; active: boolean }) {
  let d = "";
  if (type === "build-up") d = "M 5,75 C 20,75 30,60 45,42 C 60,24 78,12 95,5";
  else if (type === "peak-valley")
    d = "M 5,55 C 18,10 28,10 38,55 C 48,95 58,95 68,55 C 78,10 88,10 95,52";
  else d = "M 5,48 L 95,48";

  return (
    <svg width="100%" height={72} viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden className="text-slate-700">
      <line x1="0" y1="79" x2="100" y2="79" stroke="currentColor" strokeWidth="0.5" className="text-white/10" />
      <path
        d={d}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        className={active ? "text-primary" : "text-white/15"}
      />
    </svg>
  );
}

function MiniEnergyBar({ value }: { value: number }) {
  return (
    <div className="flex h-[18px] items-end gap-px">
      {[1, 2, 3, 4, 5].map((i) => {
        const threshold = i / 5;
        const filled = value >= threshold - 0.05;
        const barH = 5 + (i - 1) * 3;
        return (
          <div
            key={i}
            style={{ height: barH }}
            className={`w-[3px] rounded-sm ${filled ? "bg-primary" : "bg-white/10"}`}
          />
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CreatePlaylistPage() {
  const [eventType, setEventType] = useState("club");
  const [venueSize, setVenueSize] = useState("medium");
  const [genreStates, setGenreStates] = useState<Record<string, "neutral" | "like" | "dislike">>({});
  const [energyFlow, setEnergyFlow] = useState<"build-up" | "peak-valley" | "steady">("steady");
  const [durationHours, setDurationHours] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<PlaylistTrack | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<PlaylistTrack | null>(null);

  const toggleGenre = (genre: string) => {
    setGenreStates((prev) => {
      const current = prev[genre] || "neutral";
      if (current === "neutral") return { ...prev, [genre]: "like" };
      if (current === "like") return { ...prev, [genre]: "dislike" };
      const next = { ...prev };
      delete next[genre];
      return next;
    });
  };

  const generatePlaylist = async () => {
    setLoading(true);
    setError(null);
    setTracks([]);
    try {
      const likedGenres = Object.entries(genreStates)
        .filter(([, s]) => s === "like")
        .map(([g]) => g);

      const res = await fetch("/api/generate-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          venueSize,
          genres: likedGenres.length > 0 ? likedGenres : undefined,
          energyFlow,
          durationHours,
          ageRange: "20s-30s",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate playlist.");
      setTracks(data.tracks ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const likedCount = Object.values(genreStates).filter((s) => s === "like").length;
  const dislikedCount = Object.values(genreStates).filter((s) => s === "dislike").length;

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
                <ListMusic className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Create playlist</h1>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              Describe your event, tune genres and energy, then generate a set matched to duration and vibe — same
              flow as the track library.
            </p>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 sm:pt-1">AI set builder</p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-hidden />
            <p className="mt-4 text-sm font-medium text-slate-400">Building your set…</p>
            <p className="mt-1 text-xs text-slate-600">Matching tracks to energy curve and context.</p>
          </div>
        ) : tracks.length > 0 ? (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:border-b sm:border-white/5 sm:pb-3">
              <div>
                <span className="text-sm font-medium text-slate-400">
                  {tracks.length} track{tracks.length === 1 ? "" : "s"}
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  {durationHours}h · {energyFlow.replace("-", " ")} · {eventType.replace("-", " ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTracks([]);
                    setPlayingTrack(null);
                  }}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                >
                  Rebuild
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/45 bg-primary/15 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_0_0_1px_rgba(0,87,193,0.35)] transition-colors hover:bg-primary/25"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            </div>

            <section className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2">
                {tracks.map((track, i) => {
                  const kind = classifyTrackUrl(track.trackUrl ?? null);
                  return (
                    <li
                      key={`${track.id}-${i}`}
                      className={`flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
                        playingTrack?.id === track.id
                          ? "border-primary/35 bg-primary/10 ring-1 ring-primary/25"
                          : "border-white/[0.07] bg-slate-950/50 hover:border-white/12 hover:bg-slate-900/60"
                      }`}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/40 text-[11px] font-semibold tabular-nums text-slate-500">
                        {i + 1}
                      </span>
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
                          setSelectedTrack(track);
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
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            {track.genre ? (
                              <span className="rounded-md border border-white/8 bg-black/30 px-2 py-0.5">{track.genre}</span>
                            ) : null}
                            <span className="rounded-md border border-white/8 bg-black/30 px-2 py-0.5 tabular-nums">
                              {track.bpm} BPM
                            </span>
                            <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary/90">
                              {track.segment}
                            </span>
                            <MiniEnergyBar value={track.energy ?? 0.5} />
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {tracks.some((t) => t.mood_happy != null) ? (
              <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 p-1 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="rounded-[0.9rem] border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-5 sm:p-6">
                  {sectionLabel(<Headphones className="h-3.5 w-3.5 text-primary/80" />, "Set mood overview")}
                  <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                    {(
                      [
                        { key: "mood_happy" as const, label: "Happy", color: "text-sky-300", bar: "bg-sky-400" },
                        { key: "mood_relaxed" as const, label: "Relaxed", color: "text-emerald-300", bar: "bg-emerald-400" },
                        { key: "danceability" as const, label: "Dance", color: "text-fuchsia-300", bar: "bg-fuchsia-400" },
                      ] as const
                    ).map(({ key, label, color, bar }) => {
                      const withVal = tracks.filter((t) => t[key] != null);
                      const avg =
                        withVal.length > 0
                          ? withVal.reduce((s, t) => s + (t[key] as number), 0) / withVal.length
                          : 0;
                      return (
                        <div key={key} className="min-w-0 flex-1">
                          <div className="mb-1.5 flex justify-between text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            <span>{label}</span>
                            <span className={color}>{(avg * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-0.5 w-full rounded-full bg-white/10">
                            <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${avg * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-6">
            {cardShell(
              <>
                {sectionLabel(<Sparkles className="h-3.5 w-3.5 text-primary/80" />, "Event context")}
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Event type">
                  {EVENT_TYPES.map((e) => {
                    const active = eventType === e.id;
                    const Icon = EVENT_TYPE_ICONS[e.id];
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEventType(e.id)}
                        className={`flex flex-col items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                          active
                            ? "border-primary/45 bg-primary/15 text-white shadow-[0_0_0_1px_rgba(0,87,193,0.45)]"
                            : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ring-1 ${
                            active
                              ? "bg-primary/20 ring-primary/30"
                              : "bg-white/[0.04] ring-white/[0.08]"
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 shrink-0 ${active ? "text-primary" : "text-slate-500"}`}
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </span>
                        <span className="text-sm font-semibold leading-tight">{e.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/[0.06] pt-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Venue size</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Venue size">
                    {VENUE_SIZES.map((v) => {
                      const active = venueSize === v.id;
                      const { Icon } = v;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setVenueSize(v.id)}
                          className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-all ${
                            active
                              ? "border-primary/45 bg-primary/15 text-white shadow-[0_0_0_1px_rgba(0,87,193,0.45)]"
                              : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/[0.04]"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-md ring-1 ${
                              active ? "bg-primary/20 ring-primary/30" : "bg-white/[0.04] ring-white/[0.08]"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-slate-500"}`}
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          </span>
                          <span className="block text-xs font-semibold">{v.label}</span>
                          <span className="block text-[10px] text-slate-500">{v.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {cardShell(
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <Headphones className="h-3.5 w-3.5 text-primary/80" />
                    Genres
                  </div>
                  {likedCount + dislikedCount > 0 ? (
                    <span className="text-[11px] text-slate-500">
                      {likedCount > 0 ? <span className="text-emerald-400/90">+{likedCount} </span> : null}
                      {dislikedCount > 0 ? <span className="text-rose-400/90">−{dislikedCount}</span> : null}
                    </span>
                  ) : null}
                </div>
                <p className="mb-4 text-[11px] text-slate-500">Tap: neutral → like → dislike → off</p>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => {
                    const state = genreStates[g] || "neutral";
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGenre(g)}
                        className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide transition-colors ${
                          state === "like"
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                            : state === "dislike"
                              ? "border-white/[0.06] bg-transparent text-slate-600 line-through"
                              : "border-white/10 bg-black/30 text-slate-400 hover:border-white/20 hover:text-slate-200"
                        }`}
                      >
                        {state === "like" ? "+ " : state === "dislike" ? "− " : ""}
                        {g}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {cardShell(
              <>
                {sectionLabel(<Sparkles className="h-3.5 w-3.5 text-primary/80" />, "Energy journey")}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Energy flow">
                  {ENERGY_FLOWS.map((f) => {
                    const active = energyFlow === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setEnergyFlow(f.id)}
                        className={`flex flex-col items-stretch gap-2 rounded-xl border px-4 py-3 text-left transition-all ${
                          active
                            ? "border-primary/45 bg-primary/15 text-white shadow-[0_0_0_1px_rgba(0,87,193,0.45)]"
                            : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <EnergyCurveSvg type={f.id} active={active} />
                        <span className="text-sm font-semibold">{f.label}</span>
                        <span className="text-[11px] leading-snug text-slate-500">{f.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {cardShell(
              <>
                <div className="mb-5 flex items-center justify-between gap-3">
                  {sectionLabel(<ListMusic className="h-3.5 w-3.5 text-primary/80" />, "Duration")}
                  <span className="text-lg font-semibold tabular-nums text-primary">{durationHours}h</span>
                </div>
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-400">
                  Set length
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  />
                </label>
                <div className="mt-2 flex justify-between text-[10px] text-slate-600">
                  <span>1h</span>
                  <span>6h</span>
                  <span>12h</span>
                </div>
                <button
                  type="button"
                  onClick={() => void generatePlaylist()}
                  disabled={loading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/45 bg-primary py-3.5 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(0,87,193,0.45)] transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate set
                </button>
              </>
            )}

            {error ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
            ) : null}
          </div>
        )}
      </div>

      <RelatedSongsSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        selectedTrack={selectedTrack ? playlistTrackToSheet(selectedTrack) : null}
        playingTrackId={playingTrack?.id ?? null}
        onPlayTrack={(t) => {
          setPlayingTrack((prev) => (prev?.id === t.id ? null : sheetToPlaylistPlaying(t)));
        }}
      />

      {playingTrack ? (
        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[60] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto max-w-2xl">
            <AudioPlayer
              key={playingTrack.id}
              title={playingTrack.name}
              artist={playingTrack.artist}
              bpm={playingTrack.bpm}
              trackUrl={playingTrack.trackUrl ?? null}
              onClose={() => setPlayingTrack(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
