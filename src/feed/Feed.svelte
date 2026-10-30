<script lang="ts">
  import { onMount } from 'svelte';
  import type { ClipSet, FeedEvent } from '../lib/types';
  import { prefersReducedMotion, registerGsap } from '../lib/motion';
  import { createFeedInput } from './feed-input';
  import { preloadNext } from './preload';
  import FeedClip from './FeedClip.svelte';

  interface Props {
    clipSet: ClipSet;
    onevent: (e: FeedEvent) => void;
    ondone: () => void;
  }
  let { clipSet, onevent, ondone }: Props = $props();

  const AUTO_ADVANCE_MS = 4500;
  const clips = $derived(clipSet.clips);

  let index = $state(0);
  let muted = $state(true);
  let glows: Record<string, string> = $state({});
  let root: HTMLElement;
  let track: HTMLElement;
  let enteredAt = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  const glow = $derived(glows[clips[index]?.id] ?? '#6b2bff');

  function leave() {
    const clip = clips[index];
    if (clip) onevent({ kind: 'dwell', clipId: clip.id, ms: Math.round(performance.now() - enteredAt) });
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    leave();
    ondone();
  }

  function go(to: number) {
    if (finished || to < 0 || to === index) return;
    if (to >= clips.length) return finish();
    leave();
    index = to;
    enteredAt = performance.now();
    arm();
  }

  function arm() {
    clearTimeout(timer);
    timer = setTimeout(() => go(index + 1), AUTO_ADVANCE_MS);
  }

  function next() {
    if (index + 1 >= clips.length) finish();
    else go(index + 1);
  }
  function prev() {
    go(index - 1);
  }

  $effect(() => {
    preloadNext(clips, index);
  });

  // Slide the track; instant under reduced motion.
  $effect(() => {
    const y = -index * 100;
    if (!track) return;
    const gsap = registerGsap();
    if (prefersReducedMotion()) gsap.set(track, { yPercent: y });
    else gsap.to(track, { yPercent: y, duration: 0.32, ease: 'power2.out', overwrite: true });
  });

  onMount(() => {
    registerGsap();
    const cleanup = createFeedInput(root, { next, prev });
    arm();
    return () => {
      cleanup();
      clearTimeout(timer);
    };
  });

  export function currentIndex(): number {
    return index;
  }
</script>

<div class="feed-bg" style:--glow={glow}>
  <section class="feed" bind:this={root} data-testid="feed" aria-label="Стрічка">
    <div class="track" bind:this={track}>
      {#each clips as clip, i (clip.id)}
        <FeedClip
          {clip}
          active={i === index}
          {muted}
          showHint={i === 0 && index === 0}
          onlike={() => onevent({ kind: 'like', clipId: clip.id })}
          onshare={() => onevent({ kind: 'share', clipId: clip.id })}
          onunmute={() => (muted = !muted)}
          onglow={(c) => (glows[clip.id] = c)}
        />
      {/each}
    </div>
  </section>
</div>

<style>
  .feed-bg {
    position: fixed;
    inset: 0;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .feed {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    touch-action: none;
    overscroll-behavior: contain;
    container-type: size;
  }
  .track {
    height: 100%;
    display: flex;
    flex-direction: column;
    will-change: transform;
  }
  @media (min-width: 900px) {
    .feed-bg {
      background: radial-gradient(ellipse at center, color-mix(in srgb, var(--glow) 55%, #000) 0%, #000 70%);
      transition: background 0.4s;
    }
    .feed {
      width: auto;
      height: 92vh;
      aspect-ratio: 9 / 16;
      border-radius: 14px;
      box-shadow: 0 0 80px color-mix(in srgb, var(--glow) 40%, transparent);
    }
  }
</style>
