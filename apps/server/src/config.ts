import { z } from 'zod';

const webOrigin = z.string().url().refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}, 'WEB_ORIGIN doit être une origine HTTP(S), sans chemin, identifiants ni paramètres.').transform(value => new URL(value).origin);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'), PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  WEB_ORIGIN: webOrigin.default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(), COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  TRUST_PROXY: z.string().optional(),
  LIVEKIT_URL: z.string().url().optional(), LIVEKIT_API_URL: z.string().url().optional(),
  LIVEKIT_API_KEY: z.string().min(1).optional(), LIVEKIT_API_SECRET: z.string().min(24).optional(),
  MAX_ROOMS: z.coerce.number().int().positive().default(100),
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const value = schema.parse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '')));
  const voice = [value.LIVEKIT_URL, value.LIVEKIT_API_URL, value.LIVEKIT_API_KEY, value.LIVEKIT_API_SECRET];
  if (voice.some(Boolean) && !voice.every(Boolean)) throw new Error('Configurer les quatre variables LIVEKIT ensemble.');
  if (value.NODE_ENV === 'production') {
    if (!value.DATABASE_URL) throw new Error('DATABASE_URL est obligatoire en production.');
    if (!value.WEB_ORIGIN.startsWith('https://')) throw new Error('WEB_ORIGIN doit utiliser HTTPS en production.');
    if (value.COOKIE_SECURE === 'false') throw new Error('Les cookies sécurisés sont obligatoires en production.');
    if (value.LIVEKIT_URL && !value.LIVEKIT_URL.startsWith('wss://')) throw new Error('Le vocal public doit utiliser WSS en production.');
  }
  return { ...value, secureCookies: value.COOKIE_SECURE ? value.COOKIE_SECURE === 'true' : value.NODE_ENV === 'production', voiceEnabled: voice.every(Boolean) };
}
export type Config = ReturnType<typeof readConfig>;
