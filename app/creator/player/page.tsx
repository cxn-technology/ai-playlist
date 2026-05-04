"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Pause, SkipForward, SkipBack, Share2, Disc3 } from "lucide-react";

type Track = {
  id: number;
  name: string;
  artist: string;
  bpm: number;
  key: string;
  energy: number;
  similarity: number | null;
  segment?: string;
};

export default function MockPlayerPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlaylist() {
      try {
        const storedConfig = localStorage.getItem("vibeConfig");
        const config = storedConfig ? JSON.parse(storedConfig) : {};
        
        const res = await fetch("/api/generate-playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        
        const data = await res.json();
        if (data.tracks) {
          setTracks(data.tracks);
        }
      } catch (err) {
        console.error("Failed to generate playlist", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchPlaylist();
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-accent opacity-10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-4xl flex flex-col gap-6 z-10">
        <Link 
          href="/creator/setup" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Wizard
        </Link>
        
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col gap-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <Disc3 className={`w-8 h-8 text-primary ${loading ? 'animate-spin' : 'animate-spin-slow'}`} /> 
                Generated Sequence
              </h1>
              <p className="text-slate-400">Based on your UI configuration & pgvector match</p>
            </div>
            <button className="p-3 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 transition">
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12 gap-4">
                <Disc3 className="w-12 h-12 animate-spin text-primary" />
                <p>Generating pgvector similarities...</p>
              </div>
            ) : (
              tracks.map((track, idx) => (
                <div key={`${track.id}-${idx}`} className="group relative flex flex-col gap-2">
                  {/* Transition / Similarity Badge */}
                  {track.similarity && (
                    <div className="flex items-center justify-center w-full py-2">
                      <div className="bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold">
                        {track.similarity}% Mix Similarity (Key Match)
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex items-center justify-between p-4 rounded-xl transition-all ${idx === 3 ? "bg-accent/20 border border-accent/30" : "bg-slate-800/50 border border-transparent hover:bg-slate-800"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${idx === 3 ? "bg-accent" : "bg-slate-700 group-hover:bg-primary"} text-white transition-colors cursor-pointer`}>
                        {idx === 3 ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${idx === 3 ? "text-accent-50" : "text-white"}`}>{track.name}</h3>
                        <p className="text-slate-400 text-sm">{track.artist} {track.segment && <span className="text-primary text-xs ml-2">• {track.segment}</span>}</p>
                      </div>
                    </div>
                    
                    <div className="hidden sm:flex items-center gap-8 text-sm">
                      <div className="flex flex-col items-end">
                        <span className="text-slate-500">BPM</span>
                        <span className="text-slate-300 font-mono">{track.bpm}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-slate-500">Key</span>
                        <span className="text-slate-300 font-mono">{track.key}</span>
                      </div>
                      <div className="flex flex-col items-end min-w-[60px]">
                        <span className="text-slate-500">Energy</span>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${track.energy * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-center gap-6 mt-4 pt-8 border-t border-slate-800">
            <button className="text-slate-500 hover:text-white transition"><SkipBack className="w-6 h-6" /></button>
            <button className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"><Play className="w-8 h-8 ml-1" /></button>
            <button className="text-slate-500 hover:text-white transition"><SkipForward className="w-6 h-6" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
