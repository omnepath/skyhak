/**
 * SkyHak WASM Module (AssemblyScript)
 *
 * Thin scaffold establishing the TS ↔ WASM bridge.
 * Each exported function is a facet entry point.
 */

// === Health Check ===
// Returns 1 if the module is alive. Used by WasmBridge.healthCheck().
export function health_check(): i32 {
  return 1;
}

// === Math Facet ===
// AABB collision: returns 1 if the two boxes overlap, 0 otherwise.
export function aabb_collision(
  ax: f64, ay: f64, aw: f64, ah: f64,
  bx: f64, by: f64, bw: f64, bh: f64,
): i32 {
  if (ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by) {
    return 1;
  }
  return 0;
}

// === Version ===
export function version(): i32 {
  return 1;
}
