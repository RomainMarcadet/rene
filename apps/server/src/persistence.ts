import { AppearanceSchema, type AvatarAppearance, type GameResult } from '@rene/contracts';
import type { Prisma } from '@prisma/client';
import type { WordPair } from '@rene/engine';
import { drawWordPair, wordPoolKey } from './wordCycle.js';

export interface WordPoolProgress { total: number; used: number; cycle: number }

export interface Guest {
  id: string;
  tokenHash: string;
  name: string;
  appearance: AvatarAppearance;
  createdAt: Date;
}

export interface Persistence {
  getGuest(tokenHash: string): Promise<Guest | null>;
  saveGuest(guest: Guest): Promise<void>;
  recordResult(id: string, roomSessionId: string, result: GameResult): Promise<void>;
  reserveWordPair(gameId: string, pool: readonly WordPair[], random: () => number): Promise<WordPair>;
  wordPoolProgress(pool: readonly WordPair[]): Promise<WordPoolProgress>;
  close(): Promise<void>;
}

/** Explicit development/test adapter. Never silently falls back after a database error. */
class MemoryPersistence implements Persistence {
  private readonly guests = new Map<string, Guest>();
  private readonly results = new Map<string, { roomSessionId: string; result: GameResult }>();
  private readonly draws = new Map<string, WordPair>();
  private readonly cycles = new Map<string, { cycle: number; used: Set<string>; previousId: string | null }>();

  async getGuest(tokenHash: string): Promise<Guest | null> {
    const guest = this.guests.get(tokenHash);
    return guest ? { ...structuredClone(guest), appearance: AppearanceSchema.parse(guest.appearance) } : null;
  }

  async saveGuest(guest: Guest): Promise<void> {
    this.guests.set(guest.tokenHash, { ...structuredClone(guest), appearance: AppearanceSchema.parse(guest.appearance) });
  }

  async recordResult(id: string, roomSessionId: string, result: GameResult): Promise<void> {
    if (!this.results.has(id)) this.results.set(id, structuredClone({ roomSessionId, result }));
  }

  async reserveWordPair(gameId: string, pool: readonly WordPair[], random: () => number): Promise<WordPair> {
    const existing = this.draws.get(gameId);
    if (existing) return existing;
    const key = wordPoolKey(pool);
    const state = this.cycles.get(key) ?? { cycle: 1, used: new Set<string>(), previousId: null };
    const { pair, exhausted } = drawWordPair(pool, state.used, state.previousId, random);
    if (exhausted) { state.cycle++; state.used.clear(); }
    state.used.add(pair.id);
    state.previousId = pair.id;
    this.cycles.set(key, state);
    this.draws.set(gameId, pair);
    return pair;
  }

  async wordPoolProgress(pool: readonly WordPair[]): Promise<WordPoolProgress> {
    const state = this.cycles.get(wordPoolKey(pool));
    return { total: pool.length, used: state?.used.size ?? 0, cycle: state?.cycle ?? 1 };
  }

  async close(): Promise<void> {
    this.draws.clear();
    this.cycles.clear();
    this.guests.clear();
    this.results.clear();
  }
}

export async function createPersistence(databaseUrl?: string): Promise<Persistence> {
  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL est obligatoire en production.');
    return new MemoryPersistence();
  }
  // Lazy import keeps a database-free local game usable before Prisma generation.
  const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await client.$connect();

  return {
    async getGuest(tokenHash) {
      const guest = await client.guest.findUnique({ where: { tokenHash } });
      if (!guest) return null;
      return { id: guest.id, tokenHash: guest.tokenHash, name: guest.name,
        appearance: AppearanceSchema.parse(guest.appearance), createdAt: guest.createdAt };
    },
    async saveGuest(guest) {
      const appearance = AppearanceSchema.parse(guest.appearance);
      await client.guest.upsert({
        where: { id: guest.id },
        create: { ...guest, appearance },
        update: { name: guest.name, appearance },
      });
    },
    async recordResult(id, roomSessionId, result) {
      // One immutable row per game. ON CONFLICT DO NOTHING makes retries/concurrency
      // harmless and preserves the first committed result, including its score ledger.
      await client.gameResult.createMany({
        data: [{ id, roomSessionId, result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonObject }],
        skipDuplicates: true,
      });
    },
    async reserveWordPair(gameId, pool, random) {
      const key = wordPoolKey(pool);
      return client.$transaction(async tx => {
        // The row lock serializes selections across all app instances using this PostgreSQL database.
        await tx.$executeRaw`INSERT INTO "WordCycle" ("key", "cycle") VALUES (${key}, 1) ON CONFLICT DO NOTHING`;
        await tx.$queryRaw`SELECT "key" FROM "WordCycle" WHERE "key" = ${key} FOR UPDATE`;
        const existing = await tx.wordDraw.findUnique({ where: { gameId } });
        if (existing) {
          const pair = pool.find(item => item.id === existing.pairId);
          if (!pair) throw new Error('Cette partie a déjà été associée à un autre catalogue.');
          return pair;
        }
        const state = await tx.wordCycle.findUniqueOrThrow({ where: { key } });
        const records = await tx.wordDraw.findMany({ where: { scopeKey: key, cycle: state.cycle }, select: { pairId: true } });
        const used = new Set(records.map(item => item.pairId));
        const { pair, exhausted } = drawWordPair(pool, used, state.lastPairId, random);
        const cycle = state.cycle + (exhausted ? 1 : 0);
        await tx.wordCycle.update({ where: { key }, data: { cycle, lastPairId: pair.id } });
        await tx.wordDraw.create({ data: { gameId, scopeKey: key, cycle, pairId: pair.id } });
        return pair;
      });
    },
    async wordPoolProgress(pool) {
      const key = wordPoolKey(pool);
      const state = await client.wordCycle.findUnique({ where: { key } });
      const used = state ? await client.wordDraw.count({ where: { scopeKey: key, cycle: state.cycle } }) : 0;
      return { total: pool.length, used, cycle: state?.cycle ?? 1 };
    },
    async close() { await client.$disconnect(); },
  };
}
