/**
 * WASM Bridge facet interfaces.
 * Each facet is an isolated concern — file I/O, math, peripherals.
 * Every facet has a JS fallback implementation.
 */

export interface WasmFileFacet {
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, data: Uint8Array): Promise<boolean>;
  deleteFile(path: string): Promise<boolean>;
  exists(path: string): Promise<boolean>;
}

export interface WasmMathFacet {
  aabbCollision(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean;
}

export interface WasmPeripheralFacet {
  isAvailable(): boolean;
}

export interface WasmBridgeStatus {
  wasmLoaded: boolean;
  facets: {
    file: 'wasm' | 'js-fallback';
    math: 'wasm' | 'js-fallback';
    peripheral: 'stub';
  };
}
