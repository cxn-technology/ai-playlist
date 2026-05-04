/**
 * Remote MP3 hosts often omit CORS for your app origin. Browsers block JS/fetch,
 * but same-origin `/api/audio-proxy` works with `<audio src>` like a normal tab.
 */
export function waveformFetchUrl(originalUrl: string): string {
  if (typeof window === "undefined") return originalUrl;
  try {
    const absolute = new URL(originalUrl.trim());
    if (absolute.origin === window.location.origin) return originalUrl.trim();
    const proxy = new URL("/api/audio-proxy", window.location.origin);
    proxy.searchParams.set("url", originalUrl.trim());
    return proxy.toString();
  } catch {
    return originalUrl.trim();
  }
}
