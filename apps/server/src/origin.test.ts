import { describe, expect, it } from 'vitest';
import { allowsRealtimeRequest } from './origin.js';

describe('realtime origin protection through a same-origin proxy', () => {
  const lan = 'http://10.57.100.150:5173';
  const https = 'https://rene.cellule.example';

  it('accepts HTTP LAN polling without Origin or Fetch Metadata', () => {
    expect(allowsRealtimeRequest({ host: '10.57.100.150:5173' }, lan)).toBe(true);
    expect(allowsRealtimeRequest({ host: '10.57.100.150:5173', origin: lan }, lan)).toBe(true);
  });

  it('accepts HTTPS polling and WebSocket requests through Caddy', () => {
    expect(allowsRealtimeRequest({ host: 'rene.cellule.example', 'sec-fetch-site': 'same-origin' }, https)).toBe(true);
    expect(allowsRealtimeRequest({ host: 'rene.cellule.example', origin: https }, https)).toBe(true);
  });

  it.each(['https://evil.example', 'null', 'http://rene.cellule.example', ''])('rejects explicit foreign or opaque origin %s even on the correct host', origin => {
    expect(allowsRealtimeRequest({ host: 'rene.cellule.example', origin, 'sec-fetch-site': 'same-origin' }, https)).toBe(false);
  });

  it.each(['cross-site', 'same-site', 'none'])('rejects %s metadata when Origin is absent', site => {
    expect(allowsRealtimeRequest({ host: 'rene.cellule.example', 'sec-fetch-site': site }, https)).toBe(false);
  });

  it('rejects a different host or port and ignores spoofable forwarding headers', () => {
    expect(allowsRealtimeRequest({ host: '10.57.100.150:3001' }, lan)).toBe(false);
    expect(allowsRealtimeRequest({ host: 'evil.example', 'sec-fetch-site': 'same-origin', 'x-forwarded-host': 'rene.cellule.example' }, https)).toBe(false);
    expect(allowsRealtimeRequest({ 'x-forwarded-host': 'rene.cellule.example' }, https)).toBe(false);
  });
});
