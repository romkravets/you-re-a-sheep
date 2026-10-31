<script lang="ts">
  import { onMount } from 'svelte';
  import type { Answer, Content, FeedEvent, Session } from '../lib/types';
  import { buildSession } from '../lib/session';
  import { scoreRun, sheepMeter } from '../lib/score';
  import { levelFor } from '../lib/levels';
  import { prefersReducedMotion } from '../lib/motion';
  import Feed from '../feed/Feed.svelte';
  import QuestionScreen from '../quiz/QuestionScreen.svelte';
  import SheepMeter from './SheepMeter.svelte';
  import Reveal from '../verdict/Reveal.svelte';
  import Verdict from '../verdict/Verdict.svelte';

  interface Props { content: Content }
  let { content }: Props = $props();

  type Stage = 'feed1' | 'stop1' | 'reality' | 'reveal' | 'verdict';
  const FADE_MS = 600;

  function newSeed(first: boolean): number {
    if (first && import.meta.env.MODE === 'test') {
      const s = Number(new URLSearchParams(location.search).get('seed'));
      if (Number.isInteger(s) && s > 0) return s;
    }
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  const start = (first: boolean) => buildSession(content, newSeed(first), undefined, { pilot: true });

  let session: Session = $state(start(true));
  let stage = $state<Stage>('feed1');
  let answers: Answer[] = $state([]);
  let feedEvents: FeedEvent[] = $state([]);
  let qIndex = $state(0);
  let fading = $state(false);
  let timers: ReturnType<typeof setTimeout>[] = [];

  const round = $derived(stage === 'stop1' ? session.rounds[0] : session.rounds[session.rounds.length - 1]);
  const feedRound = $derived(session.rounds[0]);
  const questions = $derived(round.questions);
  const meter = $derived(sheepMeter(session, answers, feedEvents));
  const result = $derived(stage === 'reveal' || stage === 'verdict' ? scoreRun(session, answers, feedEvents, content) : undefined);
  const level = $derived(result ? levelFor(result.percent, content.levels) : undefined);
  const theme = $derived(stage === 'reality' ? 'paper' : 'feed-stop');

  function go(next: Stage) {
    stage = next;
    qIndex = 0;
    history.pushState({ stage: next }, '');
  }

  function onfeedDone() {
    if (feedRound.kind === 'feed') go('stop1');
  }

  function onanswer(a: Answer) {
    answers = [...answers, a];
    if (qIndex + 1 < questions.length) {
      qIndex += 1;
      return;
    }
    if (stage === 'stop1') crossfadeToReality();
    else go('reveal');
  }

  function crossfadeToReality() {
    if (prefersReducedMotion()) return go('reality');
    fading = true;
    timers.push(setTimeout(() => go('reality'), FADE_MS / 2));
    timers.push(setTimeout(() => (fading = false), FADE_MS));
  }

  function retry() {
    timers.forEach(clearTimeout);
    session = start(false);
    answers = [];
    feedEvents = [];
    fading = false;
    go('feed1');
  }

  onMount(() => {
    history.replaceState({ stage }, '');
    const onpop = () => {
      history.pushState({ stage }, '');
    };
    window.addEventListener('popstate', onpop);
    return () => {
      window.removeEventListener('popstate', onpop);
      timers.forEach(clearTimeout);
    };
  });
</script>

{#if stage === 'feed1' && feedRound.kind === 'feed'}
  {#key session.seed}
    <Feed clipSet={feedRound.clipSet} onevent={(e) => (feedEvents = [...feedEvents, e])} ondone={onfeedDone} />
  {/key}
{:else if stage === 'stop1' || stage === 'reality'}
  <QuestionScreen question={questions[qIndex]} {theme} index={qIndex} total={questions.length} {onanswer} />
{:else if stage === 'reveal'}
  <Reveal ui={content.ui} oncontinue={() => go('verdict')} />
{:else if result && level}
  <Verdict {result} {level} patterns={content.patterns} ui={content.ui} onretry={retry} />
{/if}

{#if stage !== 'verdict' && stage !== 'reveal'}
  <SheepMeter value={meter} theme={stage === 'reality' ? 'paper' : 'feed-stop'} />
{/if}

{#if fading}<div class="fade" aria-hidden="true"></div>{/if}

<style>
  .fade { position: fixed; inset: 0; z-index: 50; background: #000; pointer-events: none; animation: fade 600ms ease-in-out both; }
  @keyframes fade { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
</style>
