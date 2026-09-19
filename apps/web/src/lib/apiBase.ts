/**
 * Where the API lives. In production this is NEXT_PUBLIC_API_URL. During local
 * development the API runs on the same machine as the web server, so when the
 * configured address is a local/LAN one, the page follows whatever address it
 * was opened at — changing Wi-Fi then no longer points the app at a stale IP.
 */
const CONFIGURED = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function apiBase(): string {
  if (typeof window === "undefined") return CONFIGURED;
  try {
    const url = new URL(CONFIGURED);
    if (LOCAL_HOST.test(url.hostname) && LOCAL_HOST.test(window.location.hostname)) {
      return `${url.protocol}//${window.location.hostname}:${url.port || "3001"}`;
    }
  } catch { /* malformed setting — use it as given */ }
  return CONFIGURED;
}
