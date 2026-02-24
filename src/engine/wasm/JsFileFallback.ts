import type { WasmFileFacet } from './WasmTypes';

/**
 * JavaScript fallback for the file facet.
 * Uses localStorage for simple key-value storage.
 * Future: upgrade to Origin Private File System (OPFS) for real file I/O.
 */
export class JsFileFallback implements WasmFileFacet {
  private prefix = 'skyhak:file:';

  async readFile(path: string): Promise<Uint8Array | null> {
    const stored = localStorage.getItem(this.prefix + path);
    if (stored === null) return null;
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async writeFile(path: string, data: Uint8Array): Promise<boolean> {
    try {
      const binary = Array.from(data, (b) => String.fromCharCode(b)).join('');
      localStorage.setItem(this.prefix + path, btoa(binary));
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    localStorage.removeItem(this.prefix + path);
    return true;
  }

  async exists(path: string): Promise<boolean> {
    return localStorage.getItem(this.prefix + path) !== null;
  }
}
