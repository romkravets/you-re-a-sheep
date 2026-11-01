<script lang="ts" module>
  export type CrackVariant = 'stop' | 'feed-to-paper';
</script>

<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { prefersReducedMotion } from '../lib/motion';
  import { shatter, type ShatterPlan } from './shatter';
  import type { Frame } from './snapshot';

  interface Props {
    /** What breaks: a rasterised feed frame or «Стоп» stand-in (see snapshot.ts). */
    source: Frame | null;
    impact: { x: number; y: number };
    variant: CrackVariant;
    ondone: () => void;
  }
  let { source, impact, variant, ondone }: Props = $props();

  const FADE_MS = 300;
  // stop: a quick crack flash over the last feed frame (~400 ms); feed-to-paper: the big one.
  const desktop = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 900px)').matches;
  const PLANS: Record<CrackVariant, ShatterPlan> = {
    stop: { count: 8, crack: 0.1, fly: 0.3 },
    'feed-to-paper': { count: desktop ? 44 : 28, crack: 0.12, fly: 0.9 },
  };

  // Decided once at mount: a transition does not change its mind halfway.
  const crossfade = untrack(() => prefersReducedMotion() || !source);
  let canvas: HTMLCanvasElement | undefined = $state();
  let flying = $state(false);

  onMount(() => {
    if (crossfade || !source || !canvas) {
      const t = setTimeout(ondone, FADE_MS);
      return () => clearTimeout(t);
    }
    return shatter(canvas, source, impact, PLANS[variant], Math.random, () => (flying = true), ondone);
  });
</script>

{#if crossfade}
  <div class="fade" data-testid="crack-fade" aria-hidden="true"></div>
{:else}
  <canvas bind:this={canvas} class:flying data-testid="crack-canvas" aria-hidden="true"></canvas>
{/if}

<style>
  canvas,
  .fade {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 100;
  }
  canvas.flying,
  .fade {
    pointer-events: none;
  }
  .fade {
    background: #000;
    animation: fade-out 300ms ease-out both;
  }
  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
</style>
