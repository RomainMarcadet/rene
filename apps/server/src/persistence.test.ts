import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE } from '@rene/contracts';
import { createPersistence, type Guest } from './persistence.js';

afterEach(() => vi.unstubAllEnvs());

describe('guest persistence boundaries', () => {
  const guest = (): Guest => ({ id: 'guest-1', tokenHash: 'hash-of-opaque-token', name: 'René',
    appearance: { ...DEFAULT_APPEARANCE }, createdAt: new Date('2026-10-13T12:00:00Z') });

  it('keeps identity and appearance across profile updates without exposing mutable stored objects', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const persistence = await createPersistence();
    const original = guest();
    await persistence.saveGuest(original);
    original.name = 'Changed outside persistence';
    const first = await persistence.getGuest(original.tokenHash);
    expect(first?.name).toBe('René');
    expect(first?.createdAt).toEqual(new Date('2026-10-13T12:00:00Z'));
    first!.appearance.head = 'square';
    expect((await persistence.getGuest(original.tokenHash))?.appearance.head).toBe(DEFAULT_APPEARANCE.head);
    first!.name = 'Renée';
    await persistence.saveGuest(first!);
    const saved = await persistence.getGuest(original.tokenHash);
    expect(saved).toMatchObject({ id: original.id, name: 'Renée', appearance: { head: 'square' } });
    expect(await persistence.getGuest('another-token-hash')).toBeNull();
    await persistence.close();
  });

  it('discards development-only profiles when closed', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const persistence = await createPersistence();
    await persistence.saveGuest(guest());
    await persistence.close();
    expect(await persistence.getGuest(guest().tokenHash)).toBeNull();
  });

  it('refuses to lose production data through an implicit memory fallback', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(createPersistence()).rejects.toThrow('DATABASE_URL');
  });
});
