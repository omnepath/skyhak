import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import wasm from 'vite-plugin-wasm';
import { resolve } from 'path';

export default defineConfig({
  base: '/skyhak/',
  plugins: [
    svelte(),
    wasm(),
  ],
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
      '@game': resolve(__dirname, 'src/game'),
      '@ui': resolve(__dirname, 'src/ui'),
    },
  },
  build: {
    target: 'esnext',
  },
});
