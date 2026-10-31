<script lang="ts">
  interface Props { lines: string[] }
  let { lines }: Props = $props();
</script>

<ul class="chat" aria-label="Чат">
  {#each lines as line, i (i)}
    <li class:own={i % 2 === 1}>{line}</li>
  {/each}
</ul>

<style>
  .chat { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; font-family: var(--font-feed); max-width: 28rem; }
  li { align-self: flex-start; background: #2b2b2b; color: #fff; border-radius: 14px 14px 14px 4px; padding: 0.5rem 0.8rem; }
  li.own { align-self: flex-end; background: #2b5278; border-radius: 14px 14px 4px 14px; }
</style>
