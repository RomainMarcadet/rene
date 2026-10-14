import { AppearanceSchema, type AvatarAppearance, type GameResult } from '@rene/contracts';
import type { Prisma } from '@prisma/client';

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
  close(): Promise<void>;
}

/** Explicit development/test adapter. Never silently falls back after a database error. */
class MemoryPersistence implements Persistence {
  private readonly guests = new Map<string, Guest>();
  private readonly results = new Map<string, { roomSessionId: string; result: GameResult }>();

  async getGuest(tokenHash: string): Promise<Guest | null> {
    const guest = this.guests.get(tokenHash);
    return guest ? structuredClone(guest) : null;
  }

  async saveGuest(guest: Guest): Promise<void> {
    this.guests.set(guest.tokenHash, structuredClone(guest));
  }

  async recordResult(id: string, roomSessionId: string, result: GameResult): Promise<void> {
    if (!this.results.has(id)) this.results.set(id, structuredClone({ roomSessionId, result }));
  }

  async close(): Promise<void> {
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
    async close() { await client.$disconnect(); },
  };
}
