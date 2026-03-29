<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Engine } from './engine';
  import type { InputMode } from './engine/Engine';
  import { CaptainSkyhawkModule } from './game';

  let viewport: HTMLDivElement;
  let engine: Engine;
  let scaleLabel = $state('');
  let showControls = $state(true);
  let showSettings = $state(false);
  let currentInputMode = $state<InputMode>('auto');
  let touchActive = $state(false);
  let touchOpacity = $state(0.35);

  onMount(() => {
    engine = new Engine();
    engine.mount(viewport);

    engine.canvasManager.onScale((scale, mode) => {
      const pct = Math.round(scale * 100);
      const modeLabel = mode === 'fit' ? 'FIT' : mode === 'integer' ? 'PX' : `${scale.toFixed(1)}x`;
      scaleLabel = `${pct}% ${modeLabel}`;
    });

    // Trigger initial labels
    const s = engine.canvasManager.getScale();
    const m = engine.canvasManager.getScaleMode();
    const pct = Math.round(s * 100);
    const ml = m === 'fit' ? 'FIT' : m === 'integer' ? 'PX' : `${s.toFixed(1)}x`;
    scaleLabel = `${pct}% ${ml}`;
    currentInputMode = engine.inputMode;
    touchActive = engine.touchEnabled;

    engine.events.on('input:mode-changed', (data: any) => {
      touchActive = data.touchEnabled;
    });

    const game = new CaptainSkyhawkModule();
    engine.loadModule(game);
    engine.start();

    // Auto-hide controls after 4s
    setTimeout(() => { showControls = false; }, 4000);
  });

  onDestroy(() => {
    if (engine) engine.dispose();
  });

  function zoomIn() { engine?.canvasManager.zoomIn(); }
  function zoomOut() { engine?.canvasManager.zoomOut(); }
  function zoomFit() { engine?.canvasManager.zoomFit(); }
  function cycleMode() { engine?.canvasManager.cycleMode(); }
  function toggleControls() { showControls = !showControls; }
  function toggleSettings() { showSettings = !showSettings; }

  function setInputMode(mode: InputMode) {
    currentInputMode = mode;
    engine?.setInputMode(mode);
  }

  function setTouchOpacity(val: number) {
    touchOpacity = val;
    engine?.setTouchOpacity(val);
  }
</script>

<div class="shell">
  <div class="viewport" bind:this={viewport}></div>

  <!-- Zoom toggle -->
  <button class="zoom-toggle" onclick={toggleControls} title="Zoom controls">
    {scaleLabel}
  </button>

  <!-- Settings toggle -->
  <button class="settings-toggle" onclick={toggleSettings} title="Input settings">
    {touchActive ? 'TOUCH' : 'KB'}
  </button>

  <!-- Zoom controls -->
  {#if showControls}
    <div class="zoom-bar">
      <button onclick={zoomOut}>-</button>
      <button onclick={zoomFit}>FIT</button>
      <button onclick={cycleMode}>MODE</button>
      <button onclick={zoomIn}>+</button>
    </div>
  {/if}

  <!-- Input settings panel -->
  {#if showSettings}
    <div class="settings-panel">
      <div class="settings-title">Input</div>

      <div class="settings-row">
        <span class="settings-label">Mode</span>
        <div class="settings-options">
          {#each ['auto', 'keyboard', 'touch', 'gamepad'] as mode}
            <button
              class="opt-btn"
              class:active={currentInputMode === mode}
              onclick={() => setInputMode(mode as InputMode)}
            >
              {mode.toUpperCase()}
            </button>
          {/each}
        </div>
      </div>

      {#if touchActive}
        <div class="settings-row">
          <span class="settings-label">Overlay</span>
          <div class="settings-options">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={touchOpacity}
              oninput={(e) => setTouchOpacity(parseFloat(e.currentTarget.value))}
              class="opacity-slider"
            />
            <span class="opacity-value">{Math.round(touchOpacity * 100)}%</span>
          </div>
        </div>
      {/if}

      <button class="close-btn" onclick={toggleSettings}>CLOSE</button>
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
    position: relative;
  }

  /* ── Toggle buttons ─────────────────────────────────── */

  .zoom-toggle, .settings-toggle {
    position: fixed;
    bottom: 8px;
    background: rgba(30, 30, 40, 0.8);
    color: #889;
    border: 1px solid #334;
    border-radius: 4px;
    padding: 4px 8px;
    font: 11px monospace;
    cursor: pointer;
    z-index: 20;
    user-select: none;
    -webkit-user-select: none;
  }

  .zoom-toggle { right: 8px; }
  .settings-toggle { left: 8px; }

  .zoom-toggle:hover, .settings-toggle:hover {
    color: #aab;
    border-color: #556;
  }

  /* ── Zoom bar ───────────────────────────────────────── */

  .zoom-bar {
    position: fixed;
    bottom: 36px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 20;
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
  }

  .zoom-bar button:active {
    background: rgba(60, 60, 90, 0.9);
  }

  /* ── Settings panel ─────────────────────────────────── */

  .settings-panel {
    position: fixed;
    bottom: 36px;
    left: 8px;
    background: rgba(20, 20, 30, 0.95);
    border: 1px solid #445;
    border-radius: 6px;
    padding: 10px 14px;
    z-index: 20;
    min-width: 200px;
  }

  .settings-title {
    color: #88aacc;
    font: bold 12px monospace;
    margin-bottom: 8px;
    border-bottom: 1px solid #334;
    padding-bottom: 4px;
  }

  .settings-row {
    margin-bottom: 8px;
  }

  .settings-label {
    color: #778;
    font: 10px monospace;
    display: block;
    margin-bottom: 4px;
  }

  .settings-options {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .opt-btn {
    background: rgba(40, 40, 55, 0.9);
    color: #889;
    border: 1px solid #445;
    border-radius: 3px;
    padding: 3px 8px;
    font: 10px monospace;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  .opt-btn.active {
    background: rgba(60, 70, 100, 0.9);
    color: #ccddff;
    border-color: #668;
  }

  .opt-btn:hover {
    color: #aab;
    border-color: #556;
  }

  .opacity-slider {
    width: 100px;
    accent-color: #668;
    cursor: pointer;
  }

  .opacity-value {
    color: #778;
    font: 10px monospace;
    width: 32px;
    text-align: right;
  }

  .close-btn {
    background: rgba(40, 40, 55, 0.9);
    color: #889;
    border: 1px solid #445;
    border-radius: 3px;
    padding: 4px 10px;
    font: 10px monospace;
    cursor: pointer;
    width: 100%;
    margin-top: 4px;
    user-select: none;
    -webkit-user-select: none;
  }

  .close-btn:hover {
    color: #aab;
    border-color: #556;
  }
</style>
