import { describe, expect, it } from 'vitest';
import { commandId } from './commandId';
describe('commandId on a local HTTP network', () => {
  it('generates a valid UUID with secure random bytes when randomUUID is unavailable', () => {
    const id = commandId({ getRandomValues: bytes => { bytes.fill(0x1f); return bytes; } });
    expect(id).toBe('1f1f1f1f-1f1f-4f1f-9f1f-1f1f1f1f1f1f');
  });
  it('keeps the native implementation when available', () => {
    expect(commandId({ randomUUID: () => 'native-uuid', getRandomValues: () => { throw new Error('Fallback should not run'); } })).toBe('native-uuid');
  });
});
