import type { IncomingHttpHeaders } from 'node:http';

/** Caddy and the Vite proxy must preserve the browser's Host header. */
export function allowsRealtimeRequest(headers: IncomingHttpHeaders, webOrigin: string): boolean {
  // An explicit foreign (or opaque) origin always wins over other headers.
  if (headers.origin !== undefined) return headers.origin === webOrigin;

  // Same-origin polling GETs may omit Origin. On HTTP LAN addresses browsers
  // also omit Sec-Fetch-*; require the configured host in either case.
  const site = headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin') return false;
  return headers.host?.toLowerCase() === new URL(webOrigin).host;
}
