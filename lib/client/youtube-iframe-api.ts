/**
 * Loads https://www.youtube.com/iframe_api once; all callers share the same promise.
 */
let loadPromise: Promise<void> | null = null;

export function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API is client-only"));
  }

  const w = window as Window & {
    YT?: { Player: new (id: string | HTMLElement, options: object) => unknown };
    onYouTubeIframeAPIReady?: () => void;
  };

  if (w.YT?.Player) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve) => {
      const done = () => resolve();
      const prior = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prior?.();
        done();
      };

      if (w.YT?.Player) {
        done();
        return;
      }

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.async = true;
        document.head.appendChild(s);
      }
    });
  }

  return loadPromise;
}
