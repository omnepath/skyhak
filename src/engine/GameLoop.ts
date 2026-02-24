/**
 * Fixed-timestep game loop with interpolation.
 *
 * Runs update() at a fixed rate (default 60Hz) and render() as fast as
 * the browser allows via requestAnimationFrame. The alpha interpolation
 * factor is passed to render() so modes can smooth between ticks.
 */
export class GameLoop {
  private tickRate: number;
  private tickDuration: number;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private _delta = 0;
  private _time = 0;

  private onUpdate: (dt: number) => void;
  private onRender: (alpha: number) => void;

  constructor(
    targetFps: number,
    onUpdate: (dt: number) => void,
    onRender: (alpha: number) => void,
  ) {
    this.tickRate = targetFps;
    this.tickDuration = 1 / targetFps;
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  get delta(): number {
    return this._delta;
  }

  get time(): number {
    return this._time;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private frame(now: number): void {
    if (!this.running) return;

    const frameTime = Math.min((now - this.lastTime) / 1000, 0.25); // cap to avoid spiral of death
    this.lastTime = now;
    this.accumulator += frameTime;
    this._delta = this.tickDuration;

    while (this.accumulator >= this.tickDuration) {
      this.onUpdate(this.tickDuration);
      this._time += this.tickDuration;
      this.accumulator -= this.tickDuration;
    }

    const alpha = this.accumulator / this.tickDuration;
    this.onRender(alpha);

    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }
}
