import type { WasmMathFacet } from './WasmTypes';

/**
 * JavaScript fallback for the math facet.
 * Pure JS implementations of math operations that could later
 * be accelerated by WASM.
 */
export class JsMathFallback implements WasmMathFacet {
  aabbCollision(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number,
  ): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
}
