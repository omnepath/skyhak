/**
 * Input configuration: maps physical inputs to button names.
 *
 * The engine speaks in physical button names that correspond to
 * a generic game controller: A, B, X, Y, C, L, R, dpadUp, etc.
 * These are device-level names — the engine doesn't know what
 * "fire" or "boost" means.
 *
 * Game modules map these button names to game-specific actions
 * via their own ActionMap.
 *
 * Config hierarchy:
 * 1. Engine provides DEFAULT_INPUT_CONFIG (sensible defaults)
 * 2. Game module can override via engine.configureInput()
 * 3. Future: external controller profiles can override further
 */

/** Standard physical button names the engine understands */
export type ButtonName =
  | 'dpadUp'
  | 'dpadDown'
  | 'dpadLeft'
  | 'dpadRight'
  | 'A'
  | 'B'
  | 'X'
  | 'Y'
  | 'C'
  | 'L'
  | 'R'
  | 'start'
  | 'select';

/** Maps physical key codes / gamepad inputs → button names */
export interface InputConfig {
  keyboard: Record<string, ButtonName[]>;
  gamepad: Record<string, ButtonName[]>;
}

/**
 * Default keyboard mapping.
 *
 * Left hand: WASD + arrows for d-pad.
 * Right hand: SNES-style diamond on JKL/I keys:
 *       I (X)
 *   J (Y)   L (A)
 *       K (B)
 * Plus: U = C, O = R, Q = L
 * Space/Z = A (legacy), X key = B (legacy), C key = C (legacy)
 * Enter = start, Backspace/Escape = select
 */
export const DEFAULT_INPUT_CONFIG: InputConfig = {
  keyboard: {
    // D-pad — left hand (WASD) + arrows
    'ArrowLeft':  ['dpadLeft'],
    'ArrowRight': ['dpadRight'],
    'ArrowUp':    ['dpadUp'],
    'ArrowDown':  ['dpadDown'],
    'KeyA':       ['dpadLeft'],
    'KeyD':       ['dpadRight'],
    'KeyW':       ['dpadUp'],
    'KeyS':       ['dpadDown'],

    // Action buttons — right hand diamond (JKLI)
    'KeyL': ['A'],
    'KeyK': ['B'],
    'KeyI': ['X'],
    'KeyJ': ['Y'],
    'KeyU': ['C'],
    'KeyO': ['R'],
    'KeyQ': ['L'],

    // Legacy / convenience
    'Space': ['A'],
    'KeyZ':  ['A'],
    'KeyX':  ['B'],
    'KeyC':  ['C'],

    // System
    'Enter':     ['start'],
    'Escape':    ['select'],
    'Backspace': ['select'],
  },
  gamepad: {
    'button0':  ['A'],
    'button1':  ['B'],
    'button2':  ['X'],
    'button3':  ['Y'],
    'button4':  ['L'],
    'button5':  ['R'],
    'button9':  ['start'],
    'button8':  ['select'],
    'axisLeft-':  ['dpadLeft'],
    'axisLeft+':  ['dpadRight'],
    'axisUp-':    ['dpadUp'],
    'axisUp+':    ['dpadDown'],
    'dpadLeft':   ['dpadLeft'],
    'dpadRight':  ['dpadRight'],
    'dpadUp':     ['dpadUp'],
    'dpadDown':   ['dpadDown'],
  },
};

// ── Backward compatibility re-export ─────────────────────
// Adapters use InputConfig now, but the interface shape is the same
export type InputMapConfig = InputConfig;
