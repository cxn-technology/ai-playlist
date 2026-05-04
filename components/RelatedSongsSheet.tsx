"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Music, RefreshCw, Layers, Zap, Play, Pause } from "lucide-react";
import { useState, useEffect } from "react";
import { APP_CONFIG } from "@/config/app-theme";

import type { RelatedSheetTrack } from "@/components/related-songs-sheet-types";

interface RelatedSongsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrack: RelatedSheetTrack | null;
  /** Wire to your page-level player (e.g. setPlayingTrack). */
  onPlayTrack?: (track: RelatedSheetTrack) => void;
  /** Highlights playing row / header play state. */
  playingTrackId?: string | null;
}

export default function RelatedSongsSheet({
  isOpen,
  onClose,
  selectedTrack,
  onPlayTrack,
  playingTrackId,
}: RelatedSongsSheetProps) {
  const [relatedTracks, setRelatedTracks] = useState<RelatedSheetTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<RelatedSheetTrack | null>(selectedTrack);

  useEffect(() => {
    if (selectedTrack && isOpen) {
      setCurrentTrack(selectedTrack);
      void fetchRelatedTracks(selectedTrack.id);
    }
  }, [selectedTrack, isOpen]);

  const fetchRelatedTracks = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tracks/${id}/related`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch related tracks");
      setRelatedTracks(data.relatedTracks || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTrackSelect = (track: RelatedSheetTrack) => {
    setCurrentTrack(track);
    void fetchRelatedTracks(track.id);
  };

  const getMoodLabel = (track: RelatedSheetTrack) => {
    const happy = track.mood_happy ?? 0.5;
    const sad = track.mood_sad ?? 0.5;
    if (happy > sad + 0.12) return "Uplifting";
    if (sad > happy + 0.12) return "Melancholic";
    return "Balanced";
  };

  const getEnergyBadgeClass = (energy: string) =>
    energy === "Chill"
      ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
      : energy === "High Energy"
      ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";

  function playHandler(track: RelatedSheetTrack) {
    onPlayTrack?.(track);
  }

  const headerPlaying = currentTrack && playingTrackId === currentTrack.id;
  const canPlayHeader = Boolean(onPlayTrack && currentTrack?.trackUrl);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col"
          >
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-white font-bold leading-tight truncate">Recommend Songs</h2>
                  <p className="text-slate-500 text-xs truncate">
                    {APP_CONFIG.projectName}: {currentTrack?.name}
                  </p>
                  {currentTrack && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {currentTrack.bpm != null && Number.isFinite(currentTrack.bpm) && (
                        <span className="rounded-md border border-slate-600/70 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300">
                          {Math.round(currentTrack.bpm)} BPM
                        </span>
                      )}
                      {(typeof currentTrack.mood_happy === "number" || typeof currentTrack.mood_sad === "number") && (
                        <span className="rounded-md border border-slate-600/70 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300">
                          {getMoodLabel(currentTrack)}
                        </span>
                      )}
                      {currentTrack.energy && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-tighter ${getEnergyBadgeClass(currentTrack.energy)}`}
                        >
                          {currentTrack.energy}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canPlayHeader ? (
                  <button
                    type="button"
                    title={headerPlaying ? "Pause preview" : "Play preview"}
                    onClick={() => {
                      if (!currentTrack?.trackUrl) return;
                      playHandler(currentTrack);
                    }}
                    className="p-2 rounded-full hover:bg-slate-800 text-primary transition border border-primary/25"
                  >
                    {headerPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-6 space-y-6 pr-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-slate-400 text-sm animate-pulse">Analyzing sonic signatures...</p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              ) : relatedTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500 text-center">
                  <Music className="w-10 h-10 opacity-20" />
                  <p>No related tracks found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Recommendations</h3>
                  <div className="flex flex-col gap-2">
                    {relatedTracks.map((track) => {
                      const rowPlaying = playingTrackId === track.id;
                      return (
                        <div
                          key={track.id}
                          className={`flex items-stretch gap-2 p-3 rounded-xl bg-slate-800/40 border transition text-left group ${
                            rowPlaying
                              ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                              : "border-slate-700/30 hover:bg-slate-800 hover:border-primary/30"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleTrackSelect(track)}
                            className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center group-hover:bg-primary/20 transition shrink-0">
                              <Music className="w-4 h-4 text-slate-400 group-hover:text-primary transition" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-medium truncate text-sm">{track.name}</p>
                              <p className="text-slate-400 text-xs truncate">{track.artist}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md border border-slate-600/70 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300">
                                  {track.bpm != null && Number.isFinite(track.bpm)
                                    ? `${Math.round(track.bpm)} BPM`
                                    : "BPM —"}
                                </span>
                                <span className="rounded-md border border-slate-600/70 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300">
                                  {getMoodLabel(track)}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300">
                                  <Zap className="h-2.5 w-2.5 text-amber-300" />
                                  {Math.round((track.energyValue ?? 0.5) * 100)}%
                                </span>
                              </div>
                            </div>
                          </button>

                          {onPlayTrack ? (
                            <button
                              type="button"
                              title={track.trackUrl ? (rowPlaying ? "Pause preview" : "Play preview") : "No preview URL"}
                              disabled={!track.trackUrl}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!track.trackUrl) return;
                                playHandler(track);
                              }}
                              className={`flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-xl border transition ${
                                track.trackUrl
                                  ? "border-slate-600 bg-slate-900/80 text-primary hover:border-primary/50 hover:bg-primary/10"
                                  : "cursor-not-allowed border-slate-800 text-slate-600 opacity-50"
                              }`}
                            >
                              {rowPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                            </button>
                          ) : null}

                          <div
                            className={`self-center text-[10px] px-2 py-1 rounded-full border font-medium uppercase tracking-tighter shrink-0 ${getEnergyBadgeClass(track.energy || "Steady")}`}
                          >
                            {track.energy || "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="text-slate-500 shrink-0">Currently exploring from</span>
                  <span className="text-primary font-medium truncate text-right">{currentTrack?.name}</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-snug">
                  Tap a row to load similar tracks. Use the play button to preview without leaving this panel.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition text-sm flex items-center justify-center gap-2"
                >
                  Close Vibe Explore
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
