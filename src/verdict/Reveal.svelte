<script lang="ts">
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';
  import { SplitText } from 'gsap/SplitText';
  import { prefersReducedMotion } from '../lib/motion';

  interface Props { ui: Record<string, string>; oncontinue: () => void }
  let { ui, oncontinue }: Props = $props();

  const AUTO_MS = 4000;
  const sentences = $derived(ui.reveal.split(/(?<=[.!?])\s+/).filter(Boolean));
  let root: HTMLElement;
  let showTitle = $state(false);
  let done = false;
  let autoTimer: ReturnType<typeof setTimeout> | undefined;

  function proceed() {
    if (done) return;
    done = true;
    clearTimeout(autoTimer);
    oncontinue();
  }

  function armAuto() {
    autoTimer = setTimeout(proceed, AUTO_MS);
  }

  onMount(() => {
    const onkey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        proceed();
      }
    };
    window.addEventListener('keydown', onkey);

    let ctx: gsap.Context | undefined;
    if (prefersReducedMotion()) {
      showTitle = true;
      armAuto();
    } else {
      gsap.registerPlugin(SplitText);
      ctx = gsap.context(() => {
        const tl = gsap.timeline({ onComplete: armAuto });
        root.querySelectorAll<HTMLElement>('[data-sentence]').forEach((el) => {
          const split = SplitText.create(el, { type: 'chars' });
          gsap.set(el, { visibility: 'visible' });
          gsap.set(split.chars, { autoAlpha: 0 });
          tl.to(split.chars, { autoAlpha: 1, duration: 0.01, stagger: 0.025, ease: 'none' }, '+=0.25');
        });
        tl.call(() => (showTitle = true), [], '+=0.3');
      }, root);
    }
    return () => {
      window.removeEventListener('keydown', onkey);
      clearTimeout(autoTimer);
      ctx?.revert();
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<main class="reveal" data-testid="reveal" bind:this={root} onclick={proceed}>
  <div class="text">
    {#each sentences as s (s)}
      <p data-sentence class:pre={!prefersReducedMotion()}>{s}</p>
    {/each}
    {#if showTitle}<h1 class="title">{ui.projectTitle}</h1>{/if}
  </div>
</main>

<style>
  .reveal { min-height: 100dvh; box-sizing: border-box; padding: 2rem 1.4rem; display: grid; place-items: center; background: var(--paper); color: var(--ink); font-family: var(--font-book); cursor: pointer; }
  .text { max-width: 34rem; display: grid; gap: 1.1rem; }
  p { margin: 0; font-size: clamp(1.3rem, 4.5vw, 1.9rem); line-height: 1.4; }
  p.pre { visibility: hidden; }
  .title { font-family: var(--font-poster); font-weight: 900; color: var(--poster-red); margin: 1.2rem 0 0; font-size: clamp(2rem, 9vw, 3.6rem); animation: in 700ms ease-out both; }
  @keyframes in { from { opacity: 0; transform: translateY(0.4em); } to { opacity: 1; transform: none; } }
</style>
