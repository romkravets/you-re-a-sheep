<script lang="ts">
  import { onMount } from 'svelte';
  import type { Answer, Content, FeedEvent, Session } from '../lib/types';
  import { buildSession } from '../lib/session';
  import { scoreRun, sheepMeter } from '../lib/score';
  import { levelFor } from '../lib/levels';
  import Crack, { type CrackVariant } from '../crack/Crack.svelte';
  import { snapshotFeed, stopStandIn, type Frame } from '../crack/snapshot';
  import Feed from '../feed/Feed.svelte';
  import QuestionScreen from '../quiz/QuestionScreen.svelte';
  import SheepMeter from './SheepMeter.svelte';
  import Reveal from '../verdict/Reveal.svelte';
  import Verdict from '../verdict/Verdict.svelte';

  interface Props { content: Content }
  let { content }: Props = $props();

  type Stage = 'feed1' | 'stop1' | 'reality' | 'reveal' | 'verdict';

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
  // The glass shatter over a stage change; the next stage is already rendered underneath.
  let crack = $state<{ variant: CrackVariant; source: Frame | null; impact: { x: number; y: number } } | null>(null);
  let lastFeedFrame: Frame | null = null;

  const round = $derived(stage === 'stop1' ? session.rounds[0] : session.rounds[session.rounds.length - 1]);
  const feedRound = $derived(session.rounds[0]);
  const questions = $derived(round.questions);
  // Feed penalties reach the meter only after the feed ends, so it cannot flag a trap live.
  const meter = $derived(sheepMeter(session, answers, stage === 'feed1' ? [] : feedEvents));
  const result = $derived(stage === 'reveal' || stage === 'verdict' ? scoreRun(session, answers, feedEvents, content) : undefined);
  const level = $derived(result ? levelFor(result.percent, content.levels) : undefined);
  const theme = $derived(stage === 'reality' ? 'paper' : 'feed-stop');

  // Back is held only mid-test by TWO guard entries on top of the page's own entry, so even two
  // quick presses (the second landing before popstate re-arms) stay on the page. Each entry knows
  // its height `n`; popstate tops the stack back up to GUARD_DEPTH from wherever Back landed.
  // Leaving the test walks back to the page's own entry, so Back then behaves like on any other page.
  const TRAPPED: Stage[] = ['feed1', 'stop1', 'reality'];
  const GUARD_DEPTH = 2;
  let guarded = false;

  /** How many guard entries sit below and at the current one (0 = the page's own entry). */
  function height(): number {
    const st = history.state as { guard?: boolean; n?: number } | null;
    return st?.guard ? (st.n ?? 1) : 0; // entries without n: the older single-guard format
  }
  function topUp() {
    for (let n = height() + 1; n <= GUARD_DEPTH; n++) history.pushState({ guard: true, n }, '');
  }
  function guard() {
    guarded = true;
    topUp();
  }
  function unguard() {
    if (!guarded) return;
    guarded = false;
    const h = height();
    if (h > 0) history.go(-h);
  }

  function go(next: Stage) {
    stage = next;
    qIndex = 0;
    if (TRAPPED.includes(next)) guard();
    else unguard();
  }

  function onfeedDone() {
    if (feedRound.kind !== 'feed') return;
    // Snapshot the last clip now: the feed unmounts as soon as the stage changes.
    lastFeedFrame = safe(() => snapshotFeed(document.querySelector<HTMLElement>('[data-testid="feed"]')));
    shatter('stop', lastFeedFrame);
    go('stop1');
  }

  function safe(draw: () => Frame | null): Frame | null {
    try {
      return draw();
    } catch {
      return null;
    }
  }

  /** Impact near the middle of the screen, a little off-centre each time. */
  function shatter(variant: CrackVariant, source: Frame | null) {
    const jitter = () => (Math.random() - 0.5) * 0.12;
    crack = { variant, source, impact: { x: innerWidth * (0.5 + jitter()), y: innerHeight * (0.46 + jitter()) } };
  }

  function onanswer(a: Answer) {
    answers = [...answers, a];
    if (qIndex + 1 < questions.length) {
      qIndex += 1;
      return;
    }
    if (stage === 'stop1') {
      // «Стоп» is DOM text: break a stand-in of it, with the paper already rendered underneath.
      shatter('feed-to-paper', safe(() => stopStandIn(lastFeedFrame, document.querySelector<HTMLElement>('[data-testid="question-screen"]'))));
      go('reality');
    }
    else go('reveal');
  }

  function retry() {
    crack = null;
    lastFeedFrame = null;
    session = start(false);
    answers = [];
    feedEvents = [];
    go('feed1');
  }

  onMount(() => {
    // After a reload mid-test we may already sit on a guard entry: guard() only tops it up.
    guard();
    // Read where Back actually landed (history.state), not the event, so several queued pops
    // re-arm correctly; when no longer guarded (unguard's own go(-h)) this does nothing.
    const onpop = () => {
      if (guarded && TRAPPED.includes(stage)) topUp();
    };
    window.addEventListener('popstate', onpop);
    return () => {
      window.removeEventListener('popstate', onpop);
    };
  });
</script>

{#if stage === 'feed1' && feedRound.kind === 'feed'}
  {#key session.seed}
    <Feed clipSet={feedRound.clipSet} onevent={(e) => (feedEvents = [...feedEvents, e])} ondone={onfeedDone} />
  {/key}
{:else if stage === 'stop1' || stage === 'reality'}
  <QuestionScreen question={questions[qIndex]} {theme} index={qIndex} total={questions.length} herdLabel={content.ui.herdPicked} press={content.press} {onanswer} />
{:else if stage === 'reveal'}
  <Reveal ui={content.ui} oncontinue={() => go('verdict')} />
{:else if result && level}
  <Verdict {result} {level} patterns={content.patterns} ui={content.ui} onretry={retry} />
{/if}

{#if stage !== 'verdict' && stage !== 'reveal'}
  <SheepMeter value={meter} theme={stage === 'reality' ? 'paper' : 'feed-stop'} />
{/if}

{#if crack}
  {#key crack}
    {@const current = crack}
    <Crack source={current.source} impact={current.impact} variant={current.variant} ondone={() => { if (crack === current) crack = null; }} />
  {/key}
{/if}
