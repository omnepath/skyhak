/**
 * Interface for input source adapters.
 *
 * Each adapter polls a specific device type (keyboard, gamepad, touch, custom HID)
 * and reports which abstract actions are currently active.
 *
 * The InputManager composites results from all active adapters.
 */
export interface InputAdapter {
  readonly id: string;

  /** Start listening for input events */
  connect(): void;

  /** Stop listening */
  disconnect(): void;

  /** Called each tick — returns the set of action names currently held */
  poll(): Set<string>;

  /** Whether this adapter is currently connected and active */
  isConnected(): boolean;
}
