<script lang="ts">
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '../lib/motion';
  import type { Answer, Confidence, Option, PressItem, Question } from '../lib/types';
  import Explanation from './Explanation.svelte';
  import PressBackdrop from './PressBackdrop.svelte';
  import Telegram from './materials/Telegram.svelte';
  import Rewritten from './materials/Rewritten.svelte';

  interface Props {
    question: Question;
    theme: 'feed-stop' | 'paper';
    index: number;
    total: number;
    /** ui.json herdPicked, e.g. «{n}% обрали це». */
    herdLabel: string;
    /** Invented yellow-press pieces drawn behind the question. */
    press?: PressItem[];
    onanswer: (a: Answer) => void;
  }
  let { question, theme, index, total, herdLabel, press = [], onanswer }: Props = $props();

  type Step = 'pick' | 'confidence' | 'why' | 'explain';
  const CONF: { id: Confidence; label: string }[] = [
    { id: 'guess', label: 'Навмання' },
    { id: 'maybe', label: 'Мабуть' },
    { id: 'sure', label: 'Точно' },
  ];

  let step: Step = $state('pick');
  let chosen: Option['id'] | undefined = $state();
  let confidence: Confidence | undefined = $state();
  let whyChosen: Option['id'] | undefined = $state();
  let sent = false;

  // Reset all per-question state when the parent reuses this instance for another question.
  let lastId: string | undefined;
  $effect.pre(() => {
    const id = question.id;
    if (lastId === undefined || id === lastId) { lastId = id; return; }
    lastId = id;
    step = 'pick';
    chosen = undefined;
    confidence = undefined;
    whyChosen = undefined;
    sent = false;
  });

  const correct = $derived(chosen === question.correct);

  // Bring each new step (confidence, why, explanation, Було/Стало) into view on short screens.
  let root: HTMLElement;
  $effect(() => {
    if (step === 'pick') return;
    const target = (step === 'explain' && root.querySelector('[data-reveal]')) || root.querySelector('[data-step]');
    target?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });

  function pick(id: Option['id']) {
    if (step !== 'pick') return;
    chosen = id;
    step = 'confidence';
  }
  function setConfidence(c: Confidence) {
    if (step !== 'confidence') return;
    confidence = c;
    step = correct && question.why ? 'why' : 'explain';
  }
  function pickWhy(id: Option['id']) {
    if (step !== 'why') return;
    whyChosen = id;
    step = 'explain';
  }
  function next() {
    if (step !== 'explain' || sent || !chosen || !confidence) return;
    sent = true;
    const a: Answer = { questionId: question.id, chosen, confidence };
    if (whyChosen !== undefined) a.whyChosen = whyChosen;
    onanswer(a);
  }

  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      if (step === 'explain') { e.preventDefault(); next(); }
      return;
    }
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1) return;
    if (step === 'pick') { const o = question.options[n - 1]; if (o) pick(o.id); }
    else if (step === 'confidence') { const c = CONF[n - 1]; if (c) setConfidence(c.id); }
    else if (step === 'why') { const o = question.why?.options[n - 1]; if (o) pickWhy(o.id); }
  }

  onMount(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<main class="screen {theme}" data-testid="question-screen" bind:this={root}>
  {#if press.length}<PressBackdrop items={press} variant={theme === 'feed-stop' ? 'noise' : 'margins'} />{/if}
  <div class="grid" data-testid="grid" class:single={!question.material}>
    {#if question.material}
      <div class="page left">
        {#if question.material.kind === 'telegram'}
          <Telegram channel={question.material.channel} text={question.material.text} views={question.material.views} time={question.material.time} />
        {:else if question.material.kind === 'rewritten'}
          <Rewritten channel={question.material.channel} before={question.material.before} after={question.material.after} revealed={step === 'explain'} />
        {/if}
      </div>
    {/if}
    <div class="page right">
      {#if theme === 'feed-stop'}<p class="kicker">🛑 Стоп.</p>{/if}
      <p class="count">{index + 1} / {total}</p>
      <h1>{question.prompt}</h1>

      <ol class="options">
        {#each question.options as o, i (o.id)}
          <li>
            <button type="button" data-testid="option-{o.id}" class:chosen={chosen === o.id} disabled={step !== 'pick'} onclick={() => pick(o.id)}>
              <kbd>{i + 1}</kbd><span>{o.text}</span>
              {#if question.herd?.option === o.id}<span class="herd">👥 {herdLabel.replace('{n}', String(question.herd.percent))}</span>{/if}
            </button>
          </li>
        {/each}
      </ol>

      <div data-step>
        {#if step === 'confidence'}
          <h2>Наскільки ти впевнений?</h2>
          <div class="row">
            {#each CONF as c, i (c.id)}
              <button type="button" data-testid="conf-{c.id}" onclick={() => setConfidence(c.id)}><kbd>{i + 1}</kbd>{c.label}</button>
            {/each}
          </div>
        {:else if step === 'why' && question.why}
          <h2>Так. А чому?</h2>
          <ol class="options">
            {#each question.why.options as o, i (o.id)}
              <li><button type="button" data-testid="why-{o.id}" onclick={() => pickWhy(o.id)}><kbd>{i + 1}</kbd><span>{o.text}</span></button></li>
            {/each}
          </ol>
        {:else if step === 'explain' && chosen}
          <Explanation {question} {chosen} {whyChosen} onnext={next} />
        {/if}
      </div>
    </div>
  </div>
</main>

<style>
  .screen { position: relative; overflow: hidden; min-height: 100dvh; box-sizing: border-box; padding: 3rem 1rem 2rem; }
  .feed-stop { background: #000; color: #fff; font-family: var(--font-feed); }
  .paper { background: var(--paper); color: var(--ink); font-family: var(--font-book); }
  .grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr; gap: 1.5rem; max-width: 64rem; margin: 0 auto; }
  .kicker { color: #ff3b30; font-weight: 800; font-size: 1.1rem; margin: 0 0 0.3rem; }
  .count { opacity: 0.6; font-size: 0.8rem; margin: 0 0 0.4rem; }
  h1 { font-size: 1.4rem; line-height: 1.3; margin: 0 0 1rem; }
  h2 { font-size: 1.1rem; margin: 1.2rem 0 0.6rem; }
  .options { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  button { font: inherit; color: inherit; background: transparent; border: 2px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 10px; padding: 0.7rem 0.9rem; text-align: left; cursor: pointer; display: flex; gap: 0.7rem; align-items: baseline; width: 100%; box-sizing: border-box; }
  button:disabled { cursor: default; color: inherit; opacity: 0.7; }
  button.chosen { border-color: currentColor; opacity: 1; }
  .feed-stop button { background: rgba(10, 10, 10, 0.82); }
  .paper button { background: color-mix(in srgb, var(--paper) 92%, transparent); }
  .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
  .row button { justify-content: center; }
  kbd { font: 0.75rem var(--font-feed); opacity: 0.55; }
  .herd { margin-left: auto; opacity: 0.8; white-space: nowrap; }
  @media (min-width: 900px) {
    .paper .grid:not(.single) { grid-template-columns: 1fr 1fr; gap: 3rem; }
    .paper .left { border-right: 1px solid var(--rule); padding-right: 3rem; }
    .screen { padding-top: 4rem; }
  }
</style>
