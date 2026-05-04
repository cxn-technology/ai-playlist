"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Search, QrCode, RefreshCw, SlidersHorizontal, Flame, Sparkles, ChevronUp, ChevronDown, Play, Pause } from "lucide-react";
import RelatedSongsSheet from "@/components/RelatedSongsSheet";
import type { RelatedSheetTrack } from "@/components/related-songs-sheet-types";
import { AudioPlayer } from "@/components/audio-player";
import { motion, AnimatePresence, Variants } from "framer-motion";

type Track = {
  id: string;
  name: string;
  artist: string;
  trackUrl: string | null;
  bpm: number;
  energy: "Chill" | "Steady" | "High Energy";
  energyValue: number;
};

function mapSheetToSearchTrack(t: RelatedSheetTrack): Track {
  const raw = t.energy ?? "Steady";
  const energy: Track["energy"] =
    raw === "Chill" || raw === "High Energy" || raw === "Steady" ? raw : "Steady";
  return {
    id: t.id,
    name: t.name,
    artist: t.artist,
    trackUrl: t.trackUrl ?? null,
    bpm: typeof t.bpm === "number" && Number.isFinite(t.bpm) ? Math.round(t.bpm) : 0,
    energy,
    energyValue: typeof t.energyValue === "number" && Number.isFinite(t.energyValue) ? t.energyValue : 0.5,
  };
}

const TAG_API_MAP: Record<string, "dance" | "happy" | "relaxed"> = {
  electronic: "dance",
  house: "dance",
  techno: "dance",
  chill: "relaxed",
  upbeat: "happy",
  focus: "relaxed",
};

const AnimatedEqualizer = ({ color = "currentColor", size = 24 }: { color?: string, size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <motion.rect x="4" y="6" width="3" height="12" rx="1.5" animate={{ height: [12, 4, 16, 8, 12], y: [6, 14, 2, 10, 6] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} />
    <motion.rect x="10.5" y="2" width="3" height="20" rx="1.5" animate={{ height: [20, 10, 4, 16, 20], y: [2, 12, 18, 6, 2] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
    <motion.rect x="17" y="8" width="3" height="8" rx="1.5" animate={{ height: [8, 16, 4, 12, 8], y: [8, 2, 18, 10, 8] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} />
  </svg>
);

const EmptyStateWaveform = ({ primaryHex }: { primaryHex: string }) => (
  <svg width="100" height="100" viewBox="0 0 100 100">
    <motion.path
      d="M10 50 Q 30 20, 50 50 T 90 50"
      fill="transparent"
      stroke={primaryHex}
      strokeWidth="4"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ 
        pathLength: 1, 
        opacity: 1, 
        d: [
          "M10 50 Q 30 20, 50 50 T 90 50", 
          "M10 50 Q 30 80, 50 50 T 90 50", 
          "M10 50 Q 30 20, 50 50 T 90 50"
        ] 
      }}
      transition={{ 
        pathLength: { duration: 1.5, ease: "easeOut" }, 
        d: { repeat: Infinity, duration: 4, ease: "easeInOut" } 
      }}
    />
    <motion.path
      d="M10 50 Q 30 40, 50 50 T 90 50"
      fill="transparent"
      stroke={`${primaryHex}80`}
      strokeWidth="3"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ 
        pathLength: 1, 
        opacity: 1, 
        d: [
          "M10 50 Q 30 40, 50 50 T 90 50", 
          "M10 50 Q 30 60, 50 50 T 90 50", 
          "M10 50 Q 30 40, 50 50 T 90 50"
        ] 
      }}
      transition={{ 
        pathLength: { duration: 1.5, delay: 0.3, ease: "easeOut" }, 
        d: { repeat: Infinity, duration: 3, ease: "easeInOut" } 
      }}
    />
  </svg>
);

export default function SearchSongModePage() {
  const [vibe, setVibe] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null);
  const [sortBy, setSortBy] = useState<"relevance" | "bpm" | "energy">("relevance");
  const [upNextQuery, setUpNextQuery] = useState("");
  const [isClientMounted, setIsClientMounted] = useState(false);
  const trackListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    const handler = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vibe,
            searchQuery,
            selectedTag: selectedTag ? TAG_API_MAP[selectedTag] ?? null : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setTracks(data.tracks ?? []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [vibe, searchQuery, selectedTag]);

  const getVibeDetails = (v: number) => {
    if (v < 20) return { label: "Deep Chill", color: "text-indigo-400", hex: "#818cf8", bg: "bg-indigo-500/20", shadow: "shadow-indigo-500/30", emoji: "😴" };
    if (v < 40) return { label: "Chill", color: "text-blue-400", hex: "#60a5fa", bg: "bg-blue-500/20", shadow: "shadow-blue-500/30", emoji: "❄️" };
    if (v < 60) return { label: "Steady", color: "text-emerald-400", hex: "#34d399", bg: "bg-emerald-500/20", shadow: "shadow-emerald-500/30", emoji: "🌊" };
    if (v < 80) return { label: "Upbeat", color: "text-yellow-400", hex: "#facc15", bg: "bg-yellow-500/20", shadow: "shadow-yellow-500/30", emoji: "✨" };
    return { label: "Peak Energy", color: "text-orange-500", hex: "#f97316", bg: "bg-orange-500/20", shadow: "shadow-orange-500/30", emoji: "🔥" };
  };

  const currentVibe = getVibeDetails(vibe);
  const vibePresets = [
    { label: "Deep Chill", short: "Deep", value: 10 },
    { label: "Chill", short: "Chill", value: 30 },
    { label: "Steady", short: "Steady", value: 50 },
    { label: "Upbeat", short: "Up", value: 70 },
    { label: "Peak Energy", short: "Peak", value: 90 },
  ] as const;

  // Local sorting
  const sortedTracks = useMemo(
    () =>
      [...tracks].sort((a, b) => {
        if (sortBy === "bpm") return (b.bpm || 0) - (a.bpm || 0);
        if (sortBy === "energy") return (b.energyValue || 0) - (a.energyValue || 0);
        return 0; // relevance
      }),
    [tracks, sortBy]
  );

  const filteredTracks = useMemo(() => {
    if (!upNextQuery.trim()) return sortedTracks;
    const q = upNextQuery.toLowerCase();
    return sortedTracks.filter((track) =>
      track.name.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q)
    );
  }, [sortedTracks, upNextQuery]);

  const scrollTrackList = (direction: "up" | "down") => {
    const el = trackListRef.current;
    if (!el) return;
    const amount = Math.max(180, Math.round(el.clientHeight * 0.6));
    el.scrollBy({ top: direction === "up" ? -amount : amount, behavior: "smooth" });
  };

  // Framer Motion variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-[#070912] relative overflow-hidden flex flex-col items-center py-12 px-4 sm:px-8 text-slate-200">
      
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full blur-[140px] opacity-20"
          style={{ background: `radial-gradient(circle, ${currentVibe.hex} 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-[40%] -right-[20%] w-[50vw] h-[50vw] bg-fuchsia-600/10 rounded-full blur-[120px]"
          animate={{ y: [-20, 20, -20], scale: [1, 1.05, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      <div className="w-full max-w-[1200px] flex flex-col gap-8 z-10" id="main-search-container">

        {/* Header */}
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium">
            <ArrowLeft className="w-5 h-5" /> Home
          </Link>
        </header>

        {/* Main Interface Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          {/* Left Column: Search & Vibe */}
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-5 bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-10"
          >
            {/* subtle shine effect */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            {/* Search Section */}
            <div className="space-y-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-accent/40 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center bg-slate-950/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md transition-colors focus-within:border-primary/50 focus-within:bg-slate-900/80">
                  <Search className="absolute left-4 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Describe the vibe — e.g. dark techno, happy summer pop…"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      if (e.target.value) setSelectedTag(null);
                    }}
                    className="w-full bg-transparent text-white py-5 pl-12 pr-4 focus:outline-none placeholder:text-slate-500 font-medium text-lg"
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-2 mb-2 text-sm text-slate-400 font-medium ml-1">
                <Sparkles className="w-4 h-4 text-primary" /> Popular Tags
              </div>
              <div className="flex flex-wrap gap-3">
                {["electronic", "house", "techno", "chill", "upbeat", "focus"].map((tag) => {
                  const isActive = selectedTag === tag;
                  return (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      key={tag}
                      onClick={() => {
                        setSelectedTag(prev => prev === tag ? null : tag);
                        if (selectedTag !== tag) setSearchQuery("");
                      }}
                      className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border backdrop-blur-md ${
                        isActive
                          ? "bg-primary text-white border-primary shadow-[0_0_20px_rgba(var(--primary),0.4)]"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Vibe Slider */}
            {!isClientMounted ? (
              <div className="space-y-4 bg-[#0a0f18]/90 p-5 sm:p-6 rounded-3xl border border-white/[0.07] ring-1 ring-white/[0.04] relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="text-white text-sm font-black tracking-[0.18em] uppercase">Vibe Shift™</h3>
                    <p className="text-[11px] leading-snug text-slate-500">
                      Slide for fine control - segments jump to DJ-tested anchors
                    </p>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/10 px-3 py-1.5 text-sm font-bold text-emerald-300 bg-emerald-500/20 sm:self-auto">
                    <span aria-hidden>🌊</span>
                    <span>Steady</span>
                    <span className="tabular-nums text-[11px] text-slate-200/90">50%</span>
                  </div>
                </div>
                <div className="h-[132px] rounded-2xl border border-white/10 bg-slate-950/40" />
              </div>
            ) : (
            <div className="space-y-4 bg-[#0a0f18]/90 p-5 sm:p-6 rounded-3xl border border-white/[0.07] ring-1 ring-white/[0.04] relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-white text-sm font-black tracking-[0.18em] uppercase">Vibe Shift™</h3>
                  <p className="text-[11px] leading-snug text-slate-500">
                    Slide for fine control — segments jump to DJ-tested anchors
                  </p>
                </div>
                <motion.div
                  key={currentVibe.label}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/10 px-3 py-1.5 text-sm font-bold sm:self-auto ${currentVibe.bg} ${currentVibe.color}`}
                >
                  <span aria-hidden>{currentVibe.emoji}</span>
                  <span className="max-w-[9rem] truncate sm:max-w-none">{currentVibe.label}</span>
                  <span className="tabular-nums text-[11px] text-slate-200/90">{vibe}%</span>
                </motion.div>
              </div>

              {/* Single connected preset bar — same targets as slider marks below */}
              <div
                className="flex rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-inner"
                role="group"
                aria-label="Vibe presets"
              >
                {vibePresets.map((preset) => {
                  const isActive = Math.abs(vibe - preset.value) <= 8;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setVibe(preset.value)}
                      className={`min-w-0 flex-1 rounded-xl py-2 text-[10px] font-bold uppercase tracking-wide transition ${
                        isActive
                          ? "bg-primary/25 text-primary shadow-[0_0_0_1px_rgba(0,87,193,0.45)]"
                          : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"
                      }`}
                    >
                      {preset.short}
                    </button>
                  );
                })}
              </div>

              <div className="relative px-0.5 pt-1">
                <div className="absolute left-0 right-0 top-[15px] h-2 rounded-full bg-slate-800/95" />
                <motion.div
                  className="pointer-events-none absolute left-0 top-[15px] h-2 rounded-full"
                  style={{
                    width: `${vibe}%`,
                    background: `linear-gradient(90deg, #334155 0%, ${currentVibe.hex} 100%)`,
                    boxShadow: `0 0 12px ${currentVibe.hex}33`,
                  }}
                  transition={{ duration: 0.18 }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={vibe}
                  aria-valuetext={`${currentVibe.label}, ${vibe} percent`}
                  onChange={e => setVibe(parseInt(e.target.value, 10))}
                  className="relative z-10 w-full cursor-pointer appearance-none bg-transparent py-1 outline-none
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_12px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.25)]
                  [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-slate-900 [&::-moz-range-thumb]:bg-white"
                />
              </div>

              <div className="flex flex-col gap-2 border-t border-white/5 pt-3 text-[11px] sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex items-center gap-2 text-slate-500">
                  <RefreshCw className={`size-3.5 shrink-0 ${loading ? "animate-spin text-primary" : ""}`} />
                  <span>{loading ? "Updating recommendations…" : "Recommendations update as you move the vibe"}</span>
                </div>
                <div className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1 tabular-nums text-slate-300 sm:self-auto">
                  <span className="text-slate-500">Target</span>
                  <span className="font-semibold text-white">{Math.round(60 + (vibe / 100) * 120)}</span>
                  <span className="text-slate-500">BPM</span>
                </div>
              </div>
            </div>
            )}
          </motion.section>

          {/* Right Column: Track list */}
          <motion.section 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="lg:col-span-7 bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-x-hidden overflow-hidden flex flex-col min-h-[500px]"
          >
            {/* subtle shine effect */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="flex flex-col h-full">
              <div className="mb-6 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
                <div className="flex items-center gap-3 lg:pt-1">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <span className="p-2 bg-primary/20 rounded-lg text-primary flex items-center justify-center min-w-[36px] min-h-[36px]">
                      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <AnimatedEqualizer size={20} />}
                    </span>
                    Up Next
                  </h3>
                  <AnimatePresence>
                    {loading && (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                        <div className="flex space-x-1 p-1.5 bg-slate-800/50 rounded-full border border-white/10 px-2">
                          <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 0.6 }} />
                          <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                          <motion.div className="w-1.5 h-1.5 bg-primary rounded-full" animate={{ y: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Utilities: filter, sort, scroll */}
                <div className="flex flex-col gap-2 w-full lg:items-end">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={upNextQuery}
                      onChange={(e) => setUpNextQuery(e.target.value)}
                      placeholder="Filter by song or artist"
                      className="w-full sm:w-80 bg-black/30 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-full border border-white/5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-3 flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" /> Sort</span>
                      {(["relevance", "bpm", "energy"] as const).map((s) => (
                        <button 
                          key={s}
                          onClick={() => setSortBy(s)}
                          className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full transition-all duration-300 ${
                            sortBy === s 
                              ? "bg-primary text-white shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                      <button
                        onClick={() => scrollTrackList("up")}
                        className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-primary/40 transition-colors"
                        aria-label="Scroll up tracks"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => scrollTrackList("down")}
                        className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-primary/40 transition-colors"
                        aria-label="Scroll down tracks"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium px-1 lg:text-right">
                    Showing {filteredTracks.length} of {sortedTracks.length}
                  </p>
                </div>
              </div>

              <div className="min-h-[260px] relative min-w-0 overflow-x-hidden">
                {error ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-red-400 bg-red-500/5 rounded-2xl border border-red-500/10">
                    <span className="text-3xl">⚠️</span>
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                ) : tracks.length === 0 && !loading ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 gap-4 text-slate-500 bg-white/5 rounded-2xl border border-white/5 border-dashed relative overflow-hidden group">
                    <div className="relative z-10 flex items-center justify-center mb-2">
                       <EmptyStateWaveform primaryHex={currentVibe.hex} />
                    </div>
                    <p className="font-medium text-sm z-10 text-center px-4">No tracks found. Try shifting the vibe or pick a trending search.</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-sm z-10">
                      <div className="w-full text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1"><Flame className="w-3.5 h-3.5 inline mr-1 text-orange-500" /> Trending</div>
                      {["summer anthems", "deep house focus", "late night drive", "workout energy"].map(q => (
                         <button key={q} onClick={() => setSearchQuery(q)} className="text-xs px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 hover:text-white border border-white/5 rounded-full text-slate-400 transition-colors">
                           "{q}"
                         </button>
                      ))}
                    </div>
                  </div>
                ) : filteredTracks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-slate-500 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-sm font-medium">No matches for "{upNextQuery}"</p>
                    <button
                      onClick={() => setUpNextQuery("")}
                      className="text-xs px-3 py-1.5 rounded-full border border-white/10 hover:border-primary/40 hover:text-white transition-colors"
                    >
                      Clear filter
                    </button>
                  </div>
                ) : (
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    ref={trackListRef}
                    className="custom-scrollbar flex flex-col gap-3 max-h-[460px] min-w-0 overflow-x-hidden overflow-y-auto pr-1.5"
                  >
                    {filteredTracks.map((track, i) => (
                      <motion.div
                        variants={itemVariants}
                        key={`${track.id}-${i}`}
                        onClick={() => {
                          setSelectedTrack(track);
                          setIsSheetOpen(true);
                        }}
                        whileHover={{ scale: 1.005 }}
                        whileTap={{ scale: 0.995 }}
                        className={`group flex min-w-0 max-w-full items-center justify-between gap-3 p-4 px-5 rounded-2xl border cursor-pointer backdrop-blur-sm transition-all duration-300 ${
                          loading ? "opacity-60 saturate-50" : "opacity-100"
                        } bg-slate-950/40 border-white/5 hover:bg-slate-800/80 hover:border-white/10 hover:shadow-lg ${
                          playingTrack?.id === track.id ? "ring-1 ring-primary/40 border-primary/25" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-slate-100 font-bold truncate text-[15px] group-hover:text-white transition-colors">{track.name}</p>
                          <p className="text-slate-400 text-xs font-medium truncate mt-0.5">{track.artist}</p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                          <button
                            type="button"
                            title={track.trackUrl ? "Play or pause preview" : "No preview URL"}
                            disabled={!track.trackUrl}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!track.trackUrl) return;
                              setPlayingTrack((prev) => (prev?.id === track.id ? null : track));
                            }}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                              track.trackUrl
                                ? "border-white/15 bg-black/30 text-primary hover:border-primary/50 hover:bg-primary/10"
                                : "cursor-not-allowed border-white/5 bg-black/20 text-slate-600"
                            }`}
                          >
                            {playingTrack?.id === track.id ? (
                              <Pause className="h-4 w-4" aria-hidden />
                            ) : (
                              <Play className="h-4 w-4 ml-0.5" aria-hidden />
                            )}
                          </button>
                          {track.bpm && (
                            <span className="text-[11px] text-slate-400 font-mono bg-black/30 px-2 py-1 rounded-md border border-white/5">
                              {track.bpm} BPM
                            </span>
                          )}
                          <span className={`text-[11px] px-3 py-1 rounded-full border font-bold uppercase tracking-wider shadow-sm ${
                            track.energy === "Chill"
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                              : track.energy === "High Energy"
                              ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          }`}>
                            {track.energy}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* QR Modal - Keeping for potential future use */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-sm w-full flex flex-col items-center gap-6 shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowQR(false)} className="absolute top-5 right-5 w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
              <h2 className="text-2xl font-black text-white text-center">Join the Party</h2>
              <p className="text-slate-400 text-center text-sm">Scan to upvote tracks and request a vibe shift from your phone.</p>
              <div className="w-56 h-56 bg-white rounded-3xl flex items-center justify-center p-4 shadow-inner">
                <QrCode className="w-full h-full text-slate-900" />
              </div>
              <div className="w-full py-3.5 bg-black/50 border border-white/5 rounded-2xl flex items-center justify-center text-primary font-bold tracking-widest text-sm uppercase">
                zipdj.app/join/4921
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RelatedSongsSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        selectedTrack={selectedTrack}
        playingTrackId={playingTrack?.id ?? null}
        onPlayTrack={(t) => {
          setPlayingTrack((prev) => (prev?.id === t.id ? null : mapSheetToSearchTrack(t)));
        }}
      />

      {playingTrack ? (
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="mx-auto max-w-[1200px] pointer-events-auto">
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
