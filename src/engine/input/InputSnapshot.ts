/**
 * Immutable snapshot of input state for a single game tick.
 * Uses abstract action names (not raw keys) so game modes
 * are decoupled from physical input devices.
 */
export class InputSnapshot {
  private held: ReadonlySet<string>;
  private pressed: ReadonlySet<string>;
  private released: ReadonlySet<string>;

  constructor(
    held: Set<string>,
    pressed: Set<string>,
    released: Set<string>,
  ) {
    this.held = held;
    this.pressed = pressed;
    this.released = released;
  }

  /** Is the action currently held down? */
  isHeld(action: string): boolean {
    return this.held.has(action);
  }

  /** Was the action just pressed this tick? */
  isPressed(action: string): boolean {
    return this.pressed.has(action);
  }

  /** Was the action just released this tick? */
  isReleased(action: string): boolean {
    return this.released.has(action);
  }

  static empty(): InputSnapshot {
    return new InputSnapshot(new Set(), new Set(), new Set());
  }
}
