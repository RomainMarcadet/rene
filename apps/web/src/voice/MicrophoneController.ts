/** Serialize LiveKit mutations; releasing a hold always wins over an in-flight capture. */
export class MicrophoneController {
  private desired = false;
  private applied = false;
  private running = false;
  private disposed = false;
  constructor(private apply: (enabled: boolean) => Promise<unknown>, private silence: () => void, private report: () => void, private failed: (error: unknown) => void) {}
  set(enabled: boolean) {
    this.desired = enabled && !this.disposed;
    if (!this.desired) this.silence();
    void this.flush();
  }
  private async flush() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.applied !== this.desired) {
        const target = this.desired;
        try { await this.apply(target); this.applied = target; }
        catch (error) { this.desired = false; this.silence(); this.applied = target; this.failed(error); }
        if (!this.desired) this.silence();
        this.report();
      }
    } finally { this.running = false; }
  }
  dispose() { this.disposed = true; this.set(false); }
}
