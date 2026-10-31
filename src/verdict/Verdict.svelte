<script lang="ts">
  import type { Level, Pattern, RunResult } from '../lib/types';

  interface Props { result: RunResult; level: Level; patterns: Pattern[]; onretry: () => void }
  let { result, level, patterns, onretry }: Props = $props();

  const pattern = $derived(result.pattern ? patterns.find((p) => p.skill === result.pattern) : undefined);
</script>

<main class="verdict" data-testid="verdict">
  <div class="emoji" aria-hidden="true">{level.emoji}</div>
  <h1 data-testid="level-name">{level.name}</h1>
  <p class="percent" data-testid="percent">{result.percent}% думаєш сам</p>
  {#if pattern}<p class="pattern">Твій шаблон: {pattern.line}</p>{/if}
  <ul class="lines">
    {#each result.verdictLines as line (line)}<li>{line}</li>{/each}
  </ul>
  <p class="disclaimer">Це не IQ-тест. Це дзеркало.</p>
  <button type="button" onclick={onretry}>Пройти ще раз</button>
</main>

<style>
  .verdict { min-height: 100dvh; box-sizing: border-box; padding: 3rem 1.2rem; background: var(--paper); color: var(--ink); font-family: var(--font-book); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
  .emoji { font-size: 4rem; }
  h1 { font-family: var(--font-poster); margin: 0; font-size: 2rem; }
  .percent { font-size: 1.3rem; margin: 0; }
  .pattern { max-width: 34rem; margin: 0; }
  .lines { max-width: 34rem; list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; text-align: left; }
  .disclaimer { opacity: 0.7; font-style: italic; }
  button { font: inherit; background: var(--poster-red); color: #fff; border: 0; border-radius: 10px; padding: 0.8rem 1.4rem; cursor: pointer; }
</style>
