import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

describe('deployment configuration', () => {
  const production = { NODE_ENV: 'production', WEB_ORIGIN: 'https://rene.example.com', DATABASE_URL: 'postgresql://example.invalid/rene' };
  it('normalizes an origin and rejects URLs with paths or credentials', () => {
    expect(readConfig({ WEB_ORIGIN: 'https://rene.example.com:443/' }).WEB_ORIGIN).toBe('https://rene.example.com');
    for (const WEB_ORIGIN of ['invalid-url', 'https://rene.example.com/rene', 'https://user:pass@rene.example.com', 'https://rene.example.com/?room=ABCDEF', 'https://rene.example.com/#room', 'ftp://rene.example.com']) {
      expect(() => readConfig({ WEB_ORIGIN })).toThrow('WEB_ORIGIN');
    }
  });
  it('supports explicit local mode and never implicitly loses production data', () => {
    expect(readConfig({ NODE_ENV: 'development', DATABASE_URL: '' })).toMatchObject({ voiceEnabled: false, secureCookies: false });
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow('DATABASE_URL');
    expect(() => readConfig({ ...production, WEB_ORIGIN: 'http://rene.example.com' })).toThrow('HTTPS');
    expect(() => readConfig({ ...production, COOKIE_SECURE: 'false' })).toThrow('cookies');
    expect(readConfig(production).secureCookies).toBe(true);
  });
  it('rejects incomplete vocal configuration and insecure production signalling', () => {
    expect(() => readConfig({ LIVEKIT_URL: 'ws://localhost:7880' })).toThrow('quatre');
    const voice = { LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_API_URL: 'http://livekit:7880', LIVEKIT_API_KEY: 'test', LIVEKIT_API_SECRET: 'a-secure-enough-development-secret' };
    expect(readConfig(voice).voiceEnabled).toBe(true);
    expect(() => readConfig({ ...production, ...voice })).toThrow('WSS');
  });
});
