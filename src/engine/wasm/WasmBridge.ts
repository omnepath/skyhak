import type { WasmFileFacet, WasmMathFacet, WasmPeripheralFacet, WasmBridgeStatus } from './WasmTypes';
import { JsFileFallback } from './JsFileFallback';
import { JsMathFallback } from './JsMathFallback';

/**
 * WASM Bridge — the interface between TypeScript and WebAssembly.
 *
 * Composes facets (file, math, peripheral). Each facet starts with a
 * JS fallback and can be individually upgraded to a WASM implementation.
 *
 * The bridge is language-agnostic: it doesn't care whether the .wasm file
 * was compiled from AssemblyScript, Rust, or C++.
 */
export class WasmBridge {
  file: WasmFileFacet;
  math: WasmMathFacet;
  peripheral: WasmPeripheralFacet;

  private wasmInstance: WebAssembly.Instance | null = null;
  private wasmModule: WebAssembly.Module | null = null;

  constructor() {
    // Start with JS fallbacks for everything
    this.file = new JsFileFallback();
    this.math = new JsMathFallback();
    this.peripheral = { isAvailable: () => false };
  }

  /** Attempt to load a WASM module. Falls back gracefully on failure. */
  async init(wasmUrl?: string): Promise<WasmBridgeStatus> {
    if (wasmUrl) {
      try {
        const response = await fetch(wasmUrl);
        const buffer = await response.arrayBuffer();
        const importObject = this.buildImports();
        const result = await WebAssembly.instantiate(buffer, importObject);
        this.wasmModule = result.module;
        this.wasmInstance = result.instance;

        // Upgrade facets that have WASM implementations
        this.upgradeFacets();

        console.log('[WasmBridge] WASM module loaded successfully');
      } catch (err) {
        console.warn('[WasmBridge] WASM load failed, using JS fallbacks:', err);
      }
    }

    return this.getStatus();
  }

  /** Get the current status of all facets */
  getStatus(): WasmBridgeStatus {
    return {
      wasmLoaded: this.wasmInstance !== null,
      facets: {
        file: this.wasmInstance ? 'wasm' : 'js-fallback',
        math: this.wasmInstance ? 'wasm' : 'js-fallback',
        peripheral: 'stub',
      },
    };
  }

  /** Health check: verify the WASM module is responsive */
  healthCheck(): boolean {
    if (!this.wasmInstance) return false;
    const exports = this.wasmInstance.exports;
    if (typeof exports.health_check === 'function') {
      return (exports.health_check as () => number)() === 1;
    }
    return true;
  }

  private buildImports(): WebAssembly.Imports {
    return {
      env: {
        abort: (msg: number, file: number, line: number, col: number) => {
          console.error(`WASM abort at ${file}:${line}:${col} - ${msg}`);
        },
        'console.log': (ptr: number) => {
          console.log('[WASM]', ptr);
        },
      },
    };
  }

  private upgradeFacets(): void {
    // Future: wire WASM exports to facet implementations
    // For now, we keep JS fallbacks until WASM modules export the right functions
    const exports = this.wasmInstance?.exports;
    if (!exports) return;

    // Example: if WASM exports aabb_collision, upgrade math facet
    if (typeof exports.aabb_collision === 'function') {
      const wasmCollision = exports.aabb_collision as (
        ax: number, ay: number, aw: number, ah: number,
        bx: number, by: number, bw: number, bh: number,
      ) => number;

      this.math = {
        aabbCollision: (ax, ay, aw, ah, bx, by, bw, bh) =>
          wasmCollision(ax, ay, aw, ah, bx, by, bw, bh) !== 0,
      };
    }
  }
}
