<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Engine } from './engine';
  import { CaptainSkyhawkModule } from './game';

  let viewport: HTMLDivElement;
  let engine: Engine;
  let status = 'Initializing...';

  onMount(() => {
    engine = new Engine();
    engine.mount(viewport);

    const game = new CaptainSkyhawkModule();
    engine.loadModule(game);

    engine.start();
    status = 'Captain Skyhawk — SkyHak Engine v0.1';
  });

  onDestroy(() => {
    if (engine) {
      engine.dispose();
    }
  });
</script>

<div class="shell">
  <div class="viewport" bind:this={viewport}></div>
  <div class="status-bar">{status}</div>
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
  }

  .viewport {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    width: 100%;
  }

  .status-bar {
    color: #555;
    font-family: monospace;
    font-size: 11px;
    padding: 4px 8px;
    text-align: center;
  }
</style>
