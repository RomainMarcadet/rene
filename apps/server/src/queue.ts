/** Serialize room mutations, including timers, without stopping other rooms. */
export class SerialQueue {
  private tails = new Map<string, Promise<unknown>>();
  run<T>(key: string, action: () => Promise<T> | T): Promise<T> {
    const next = (this.tails.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
    this.tails.set(key, next);
    void next.finally(() => { if (this.tails.get(key) === next) this.tails.delete(key); }).catch(() => undefined);
    return next;
  }
  async drain() { await Promise.allSettled([...this.tails.values()]); }
}

export class TokenBucket {
  private tokens: number;
  private at = Date.now();
  constructor(private capacity: number, private perSecond: number) { this.tokens = capacity; }
  take(now = Date.now()) {
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.at) / 1000 * this.perSecond); this.at = now;
    if (this.tokens < 1) return false;
    this.tokens--; return true;
  }
}
