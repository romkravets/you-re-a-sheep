<script lang="ts">
  import { wordDiff } from '../word-diff';

  interface Props { channel: string; before: string; after: string; revealed: boolean }
  let { channel, before, after, revealed }: Props = $props();
  const diff = $derived(wordDiff(before, after));
</script>

<div class="wrap">
  {#if !revealed}
    <article class="post">
      <header>@{channel}</header>
      <p>{after}</p>
    </article>
  {:else}
    <div class="pair">
      <section>
        <h3>Було</h3>
        <p data-testid="diff-before">
          {#each diff.before as s, i (i)}{#if s.changed}<mark>{s.text}</mark>{:else}{s.text}{/if}{' '}{/each}
        </p>
      </section>
      <section>
        <h3>Стало</h3>
        <p data-testid="diff-after">
          {#each diff.after as s, i (i)}{#if s.changed}<mark>{s.text}</mark>{:else}{s.text}{/if}{' '}{/each}
        </p>
      </section>
    </div>
  {/if}
</div>

<style>
  .post, section { background: var(--paper-deep); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; padding: 0.9rem 1rem; font-family: var(--font-book); }
  header { font-family: var(--font-feed); font-weight: 600; margin-bottom: 0.4rem; }
  p { margin: 0; line-height: 1.5; }
  h3 { margin: 0 0 0.4rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-soft); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
  @media (max-width: 600px) { .pair { grid-template-columns: 1fr; } }
  mark { background: #ffd54a; color: var(--ink); padding: 0 0.15em; border-radius: 2px; }
</style>
