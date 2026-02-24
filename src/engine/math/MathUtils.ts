/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map value from one range to another */
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Degrees to radians */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Radians to degrees */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Convert isometric world coords to screen coords */
export function isoToScreen(wx: number, wy: number): { sx: number; sy: number } {
  return {
    sx: (wx - wy),
    sy: (wx + wy) / 2,
  };
}

/** Convert screen coords to isometric world coords */
export function screenToIso(sx: number, sy: number): { wx: number; wy: number } {
  return {
    wx: sy + sx / 2,
    wy: sy - sx / 2,
  };
}

/** AABB overlap test */
export function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
