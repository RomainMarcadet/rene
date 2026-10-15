import { describe, expect, it, vi } from 'vitest';
import { MicrophoneController } from './MicrophoneController';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('microphone intent serialization', () => {
  it('mutes a capture that completes after key release, without concurrent mutations', async () => {
    let release!: () => void; let actual = false; let inFlight = 0; let maximum = 0;
    const calls: boolean[] = [];
    const controller = new MicrophoneController(async enabled => {
      maximum = Math.max(maximum, ++inFlight); calls.push(enabled);
      if (enabled) await new Promise<void>(resolve => { release = resolve; });
      actual = enabled; inFlight--;
    }, () => { actual = false; }, () => undefined, () => undefined);
    controller.set(true); controller.set(true); controller.set(false);
    release(); await tick();
    expect(actual).toBe(false); expect(calls).toEqual([true, false]); expect(maximum).toBe(1);
  });
  it('converges to the latest hold during rapid presses and stops on disposal', async () => {
    const apply = vi.fn(async (_enabled: boolean) => undefined);
    const controller = new MicrophoneController(apply, () => undefined, () => undefined, () => undefined);
    controller.set(true); controller.set(false); controller.set(true); await tick();
    expect(apply).toHaveBeenLastCalledWith(true);
    controller.dispose(); controller.set(true); await tick();
    expect(apply).toHaveBeenLastCalledWith(false);
  });
  it('does not leave the microphone wanted after a permission failure', async () => {
    const failed = vi.fn(); const silence = vi.fn();
    const apply = vi.fn(async (enabled: boolean) => { if (enabled) throw new Error('NotAllowedError'); });
    const controller = new MicrophoneController(apply, silence, () => undefined, failed);
    controller.set(true); await tick();
    expect(failed).toHaveBeenCalledOnce(); expect(silence).toHaveBeenCalled(); expect(apply).toHaveBeenLastCalledWith(false);
  });
});
