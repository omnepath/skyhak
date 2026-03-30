/**
 * Immutable snapshot of input state for a single game tick.
 * Uses physical button names (A, B, dpadUp, start, etc.)
 * so game modes are decoupled from physical input devices.
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

  /** Is the button currently held down? */
  isHeld(button: string): boolean {
    return this.held.has(button);
  }

  /** Was the button just pressed this tick? */
  isPressed(button: string): boolean {
    return this.pressed.has(button);
  }

  /** Was the button just released this tick? */
  isReleased(button: string): boolean {
    return this.released.has(button);
  }

  static empty(): InputSnapshot {
    return new InputSnapshot(new Set(), new Set(), new Set());
  }
}
