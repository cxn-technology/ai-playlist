"use client";

import { useState } from "react";
import { Activity, Calendar, MapPin, Music, Settings2, Sliders, CheckCircle2 } from "lucide-react";
import { EnergyCurveChart } from "./EnergyCurveChart";

type WizardState = {
  eventType: string;
  venueSize: string;
  genres: string[];
  energyFlow: string;
  durationHours: number;
  ageRange: string;
};

const STEPS = [
  { id: 1, label: "Event Type", icon: Calendar },
  { id: 2, label: "Venue & Audience", icon: MapPin },
  { id: 3, label: "Genres", icon: Music },
  { id: 4, label: "Timing & Energy", icon: Activity },
  { id: 5, label: "Preferences", icon: Sliders },
  { id: 6, label: "Review", icon: CheckCircle2 },
];

export function Wizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    eventType: "club",
    venueSize: "medium",
    genres: [],
    energyFlow: "peak-valley",
    durationHours: 4,
    ageRange: "26-35",
  });

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => setCurrentStep((p) => Math.min(p + 1, 6));
  const prevStep = () => setCurrentStep((p) => Math.max(p - 1, 1));

  const toggleGenre = (genre: string) => {
    if (state.genres.includes(genre)) {
      updateState({ genres: state.genres.filter(g => g !== genre) });
    } else {
      updateState({ genres: [...state.genres, genre] });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      {/* Stepper Header */}
      <div className="flex justify-between items-center relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 -z-10 rounded-full" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
        />

        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isPast = currentStep > step.id;
          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isActive
                    ? "bg-slate-900 border-primary text-primary"
                    : isPast
                      ? "bg-primary border-primary text-white"
                      : "bg-slate-900 border-slate-700 text-slate-500"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium hidden sm:block ${isActive ? "text-slate-200" : isPast ? "text-slate-400" : "text-slate-600"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 sm:p-10 min-h-[400px]">
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">What type of event is this?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {["club", "festival", "corporate", "private"].map((type) => (
                <button
                  key={type}
                  onClick={() => updateState({ eventType: type })}
                  className={`p-6 rounded-xl border text-left transition-all ${
                    state.eventType === type
                      ? "bg-primary/20 border-primary text-white"
                      : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  }`}
                >
                  <span className="capitalize text-lg font-medium">{type}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">Venue & Audience Details</h2>
            <div className="space-y-4">
              <label className="text-sm text-slate-400">Venue Size</label>
              <div className="grid grid-cols-3 gap-4">
                {["small", "medium", "massive"].map((size) => (
                  <button
                    key={size}
                    onClick={() => updateState({ venueSize: size })}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      state.venueSize === size
                        ? "bg-primary/20 border-primary text-white"
                        : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <span className="capitalize">{size}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">Select Primary Genres</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {["House", "Techno", "Hip-hop", "Pop", "Rock", "R&B", "Disco", "Afrobeat", "Drum & Bass"].map((genre) => {
                const isSelected = state.genres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "bg-accent/20 border-accent text-white"
                        : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <span>{genre}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">Timing & Energy Flow</h2>

            <div className="space-y-4">
              <label className="text-sm text-slate-400">Duration (Hours): {state.durationHours}</label>
              <input
                type="range"
                min="1" max="8"
                value={state.durationHours}
                onChange={(e) => updateState({ durationHours: parseInt(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-4 pt-6">
              <label className="text-sm text-slate-400">Energy Profile</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: "steady", label: "Steady Grooves", desc: "Consistent vibe throughout" },
                  { id: "build-up", label: "Progressive Build", desc: "Starts slow, ends massive" },
                  { id: "peak-valley", label: "Peak & Valley", desc: "Dynamic waves of energy" },
                ].map((flow) => (
                  <button
                    key={flow.id}
                    onClick={() => updateState({ energyFlow: flow.id })}
                    className={`p-4 flex flex-col items-start rounded-xl border text-left transition-all ${
                      state.energyFlow === flow.id
                        ? "bg-primary/20 border-primary text-white"
                        : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <span className="font-medium text-slate-200">{flow.label}</span>
                    <span className="text-xs text-slate-500 mt-1">{flow.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">Audience Preferences</h2>

            <div className="space-y-4">
              <label className="text-sm text-slate-400">Demographic Age Range</label>
              <div className="grid grid-cols-2 gap-4">
                {["18-25", "26-35", "36-50", "50+"].map((age) => (
                  <button
                    key={age}
                    onClick={() => updateState({ ageRange: age })}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      state.ageRange === age
                        ? "bg-primary/20 border-primary text-white"
                        : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <span>{age}</span>
                    {age === "36-50" && state.ageRange === age && (
                      <div className="text-xs text-primary mt-1">Biasing 90s/00s era</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Review & Generate</h2>
            <p className="text-slate-400 mb-6">Review your predicted energy curve based on your selections.</p>

            <EnergyCurveChart energyFlow={state.energyFlow} durationHours={state.durationHours} />

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-xs text-slate-500">Event</div>
                <div className="text-sm text-slate-200 capitalize">{state.eventType} • {state.venueSize}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Genres</div>
                <div className="text-sm text-slate-200">{state.genres.length > 0 ? state.genres.join(", ") : "Any"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Age Base</div>
                <div className="text-sm text-slate-200">{state.ageRange}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Flow Profile</div>
                <div className="text-sm text-slate-200 capitalize">{state.energyFlow.replace("-", " ")}</div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-between items-center px-4 sm:px-0">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className="px-6 py-3 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:hover:text-slate-400 transition-colors"
        >
          Back
        </button>
        {currentStep < 6 ? (
          <button
            onClick={nextStep}
            className="px-6 py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all transform hover:scale-105"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={() => {
              localStorage.setItem("vibeConfig", JSON.stringify(state));
              window.location.href = "/creator/player";
            }}
            className="px-8 py-3 bg-accent text-white rounded-xl shadow-lg shadow-accent/20 hover:bg-accent/80 transition-all transform hover:scale-105 font-medium flex items-center gap-2"
          >
            <Settings2 className="w-4 h-4" />
            Generate Playlist Base
          </button>
        )}
      </div>
    </div>
  );
}

