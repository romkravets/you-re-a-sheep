<script lang="ts">
  import type { Level, Pattern, RunResult } from '../lib/types';

  interface Props { result: RunResult; level: Level; patterns: Pattern[]; ui: Record<string, string>; onretry: () => void }
  let { result, level, patterns, ui, onretry }: Props = $props();

  const pattern = $derived(result.pattern ? patterns.find((p) => p.skill === result.pattern) : undefined);
  const levelNo = $derived(['sheep', 'molly', 'boxer', 'benjamin', 'orwell'].indexOf(level.id) + 1);
</script>

<main class="verdict" data-testid="verdict">
  <div class="character" aria-hidden="true">{level.emoji}</div>
  <div class="body">
    <p class="level-of" data-testid="level-of">{ui.levelOf.replace('{n}', String(levelNo))}</p>
    <h1 data-testid="level-name">{level.name}</h1>
    <p class="percent" data-testid="percent">{result.percent}% {ui.percentLabel}</p>
    <p class="description">{level.description}</p>
    {#if pattern}
      <p class="pattern" data-testid="pattern"><span class="prefix">{ui.patternPrefix}</span> <strong>{pattern.line}</strong></p>
    {/if}
    <ul class="lines">
      {#each result.verdictLines as line (line)}<li>{line}</li>{/each}
    </ul>
    <p class="disclaimer">{ui.disclaimer}</p>
    <button type="button" onclick={onretry}>{ui.retry}</button>
  </div>
</main>

<style>
  .verdict { min-height: 100dvh; box-sizing: border-box; padding: 2.5rem 1.2rem 3rem; background: var(--paper); color: var(--ink); font-family: var(--font-book); display: flex; flex-direction: column; align-items: center; gap: 1.2rem; }
  .character { font-size: 6rem; line-height: 1; }
  .body { max-width: 36rem; display: grid; gap: 0.9rem; }
  .level-of { margin: 0; font-size: 0.95rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
  h1 { font-family: var(--font-poster); font-weight: 900; color: var(--poster-red); margin: 0; font-size: clamp(2rem, 9vw, 3.2rem); line-height: 1.05; overflow-wrap: anywhere; }
  .percent { font-size: 1.4rem; font-weight: 700; margin: 0; }
  .description { margin: 0; line-height: 1.55; font-size: 1.05rem; }
  .pattern { margin: 0.4rem 0; padding: 0.8rem 0 0.8rem 1rem; border-left: 4px solid var(--poster-red); font-size: 1.3rem; line-height: 1.4; }
  .pattern .prefix { color: var(--ink-soft); }
  .pattern strong { font-weight: 700; }
  .lines { list-style: disc; padding-left: 1.2rem; margin: 0; display: grid; gap: 0.4rem; line-height: 1.5; }
  .disclaimer { opacity: 0.7; font-style: italic; margin: 0.6rem 0 0; }
  button { justify-self: start; font: inherit; background: var(--poster-red); color: #fff; border: 0; border-radius: 10px; padding: 0.8rem 1.4rem; cursor: pointer; }
  @media (min-width: 900px) {
    .verdict { flex-direction: row; justify-content: center; align-items: center; gap: 4rem; padding: 3rem; }
    .character { font-size: 14rem; }
  }
</style>
