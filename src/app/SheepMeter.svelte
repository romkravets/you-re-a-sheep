<script lang="ts">
  import { prefersReducedMotion, registerGsap } from '../lib/motion';

  interface Props { value: number; theme: 'feed-stop' | 'paper' }
  let { value, theme }: Props = $props();
  let fill: HTMLElement;
  let first = true;

  $effect(() => {
    const pct = Math.max(0, Math.min(100, value));
    if (first || prefersReducedMotion()) {
      first = false;
      fill.style.width = `${pct}%`;
    } else {
      registerGsap().to(fill, { width: `${pct}%`, duration: 0.6, ease: 'power2.out', overwrite: true });
    }
  });
</script>

<div class="meter {theme}" role="progressbar" aria-label="рівень вівці" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(value)}>
  <span class="label">рівень вівці</span>
  <span class="bar"><span class="fill" bind:this={fill}></span></span>
</div>

<style>
  .meter { position: fixed; z-index: 20; top: 0; left: 0; right: 0; padding: 0.4rem 1rem; display: flex; align-items: center; gap: 0.6rem; font: 0.7rem var(--font-feed); pointer-events: none; }
  .feed-stop { color: #fff; }
  .paper { color: var(--ink); }
  .bar { flex: 1; height: 4px; border-radius: 2px; background: color-mix(in srgb, currentColor 20%, transparent); overflow: hidden; }
  .fill { display: block; height: 100%; width: 0; background: var(--poster-red); }
  @media (min-width: 900px) {
    .meter { right: auto; width: 14rem; top: 0.6rem; left: 0.8rem; }
  }
</style>
