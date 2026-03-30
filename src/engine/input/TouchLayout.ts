/**
 * Touch overlay configuration.
 *
 * Defines the visual layout and hit regions for touch controls.
 * Buttons map to physical ButtonName values, not game actions.
 * Game modules interpret button names via their own ActionMap.
 */

import type { ButtonName } from './InputMap';

export interface TouchButtonDef {
  id: string;
  /** Physical button(s) this touch target produces */
  button: ButtonName | ButtonName[];
  /** Center X in normalized screen space (0=left, 1=right) */
  nx: number;
  /** Center Y in normalized screen space (0=top, 1=bottom) */
  ny: number;
  /** Radius in normalized screen units (relative to screen width) */
  radius: number;
  /** Display label */
  label: string;
  /** Visual shape */
  shape: 'circle' | 'rect';
  /** Width/height for rect shape (normalized) */
  width?: number;
  height?: number;
}

export interface DPadDef {
  /** Center position */
  nx: number;
  ny: number;
  /** Overall radius of the d-pad region */
  radius: number;
  /** Dead zone in center (0-1 of radius) */
  deadZone: number;
}

export interface TouchOverlayLayout {
  dpad: DPadDef;
  buttons: TouchButtonDef[];
  opacity: number;
}

/**
 * Default SNES-style layout:
 *
 * D-pad left, action diamond right, bumpers above clusters,
 * Start/Select center-bottom (Start on right).
 *
 * Right cluster diamond:
 *         X
 *     Y       A
 *         B
 * Plus C above-right.
 */
export const DEFAULT_TOUCH_LAYOUT: TouchOverlayLayout = {
  dpad: {
    nx: 0.15,
    ny: 0.72,
    radius: 0.12,
    deadZone: 0.25,
  },
  buttons: [
    // SNES diamond — right cluster
    { id: 'btnA', button: 'A',     nx: 0.87, ny: 0.68, radius: 0.045, label: 'A', shape: 'circle' },
    { id: 'btnB', button: 'B',     nx: 0.78, ny: 0.78, radius: 0.045, label: 'B', shape: 'circle' },
    { id: 'btnX', button: 'X',     nx: 0.78, ny: 0.58, radius: 0.045, label: 'X', shape: 'circle' },
    { id: 'btnY', button: 'Y',     nx: 0.69, ny: 0.68, radius: 0.045, label: 'Y', shape: 'circle' },
    // C button — above-right of diamond
    { id: 'special', button: 'C',  nx: 0.90, ny: 0.52, radius: 0.035, label: 'C', shape: 'circle' },
    // Bumpers — above each cluster
    { id: 'bumperL', button: 'L',  nx: 0.15, ny: 0.48, radius: 0.035, label: 'L', shape: 'rect', width: 0.10, height: 0.04 },
    { id: 'bumperR', button: 'R',  nx: 0.85, ny: 0.42, radius: 0.035, label: 'R', shape: 'rect', width: 0.10, height: 0.04 },
    // Center — Select left, Start right
    { id: 'select', button: 'select', nx: 0.40, ny: 0.94, radius: 0.03, label: 'SELECT', shape: 'rect', width: 0.09, height: 0.035 },
    { id: 'start',  button: 'start',  nx: 0.55, ny: 0.94, radius: 0.03, label: 'START',  shape: 'rect', width: 0.09, height: 0.035 },
  ],
  opacity: 0.5,
};
