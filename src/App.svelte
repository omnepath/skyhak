<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Engine } from './engine';
  import { CaptainSkyhawkModule } from './game';
  import type { ScaleMode } from './engine/render/CanvasManager';

  let viewport: HTMLDivElement;
  let engine: Engine;
  let scaleLabel = $state('');
  let showControls = $state(true);

  onMount(() => {
    engine = new Engine();
    engine.mount(viewport);

    engine.canvasManager.onScale((scale, mode) => {
      const pct = Math.round(scale * 100);
      const modeLabel = mode === 'fit' ? 'FIT' : mode === 'integer' ? 'PX' : `${scale.toFixed(1)}x`;
      scaleLabel = `${pct}% ${modeLabel}`;
    });

    // Trigger initial label
    const s = engine.canvasManager.getScale();
    const m = engine.canvasManager.getScaleMode();
    const pct = Math.round(s * 100);
    const ml = m === 'fit' ? 'FIT' : m === 'integer' ? 'PX' : `${s.toFixed(1)}x`;
    scaleLabel = `${pct}% ${ml}`;

    const game = new CaptainSkyhawkModule();
    engine.loadModule(game);
    engine.start();

    // Auto-hide controls after 4s
    setTimeout(() => { showControls = false; }, 4000);
  });

  onDestroy(() => {
    if (engine) engine.dispose();
  });

  function zoomIn() {
    engine?.canvasManager.zoomIn();
  }

  function zoomOut() {
    engine?.canvasManager.zoomOut();
  }

  function zoomFit() {
    engine?.canvasManager.zoomFit();
  }

  function cycleMode() {
    engine?.canvasManager.cycleMode();
  }

  function toggleControls() {
    showControls = !showControls;
  }
</script>

<div class="shell">
  <div class="viewport" bind:this={viewport}></div>

  <!-- Zoom toggle (always visible) -->
  <button class="zoom-toggle" onclick={toggleControls} title="Zoom controls">
    {scaleLabel}
  </button>

  <!-- Zoom controls (toggle visibility) -->
  {#if showControls}
    <div class="zoom-bar">
      <button onclick={zoomOut} title="Zoom out">-</button>
      <button onclick={zoomFit} title="Fit to screen">FIT</button>
      <button onclick={cycleMode} title="Cycle scale mode">MODE</button>
      <button onclick={zoomIn} title="Zoom in">+</button>
    </div>
  {/if}
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    background: #111;
    overflow: auto;
    position: relative;
  }

  .viewport {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    width: 100%;
    overflow: auto;
  }

  .zoom-toggle {
    position: fixed;
    bottom: 8px;
    right: 8px;
    background: rgba(30, 30, 40, 0.8);
    color: #889;
    border: 1px solid #334;
    border-radius: 4px;
    padding: 4px 8px;
    font: 11px monospace;
    cursor: pointer;
    z-index: 10;
    user-select: none;
    -webkit-user-select: none;
  }

  .zoom-toggle:hover {
    color: #aab;
    border-color: #556;
  }

  .zoom-bar {
    position: fixed;
    bottom: 36px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
  }

  .zoom-bar button {
    background: rgba(30, 30, 40, 0.9);
    color: #aab;
    border: 1px solid #445;
    border-radius: 4px;
    padding: 6px 12px;
    font: 12px monospace;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    min-width: 36px;
  }

  .zoom-bar button:hover {
    background: rgba(50, 50, 70, 0.9);
    color: #dde;
    border-color: #667;
  }

  .zoom-bar button:active {
    background: rgba(60, 60, 90, 0.9);
  }
</style>
