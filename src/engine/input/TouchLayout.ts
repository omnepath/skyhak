/**
 * Touch overlay configuration.
 *
 * Defines the visual layout and hit regions for touch controls.
 * All coordinates are in normalized screen space (0-1) so they
 * scale with viewport size.
 */

import type { GameAction } from './InputMap';

export interface TouchButtonDef {
  id: string;
  action: GameAction | GameAction[];
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

/** Default classic layout: D-pad left, A/B right, Start/Select center-bottom */
export const DEFAULT_TOUCH_LAYOUT: TouchOverlayLayout = {
  dpad: {
    nx: 0.15,
    ny: 0.72,
    radius: 0.12,
    deadZone: 0.25,
  },
  buttons: [
    { id: 'btnB', action: 'altFire',  nx: 0.75, ny: 0.75, radius: 0.045, label: 'B', shape: 'circle' },
    { id: 'btnA', action: 'fire',     nx: 0.87, ny: 0.68, radius: 0.045, label: 'A', shape: 'circle' },
    { id: 'start',  action: 'pause',   nx: 0.55, ny: 0.94, radius: 0.03,  label: 'START',  shape: 'rect', width: 0.09, height: 0.035 },
    { id: 'select', action: 'cancel',  nx: 0.40, ny: 0.94, radius: 0.03,  label: 'SELECT', shape: 'rect', width: 0.09, height: 0.035 },
    { id: 'special', action: 'special', nx: 0.87, ny: 0.55, radius: 0.035, label: 'C', shape: 'circle' },
  ],
  opacity: 0.35,
};
