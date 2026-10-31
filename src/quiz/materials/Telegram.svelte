<script lang="ts">
  interface Props { channel: string; text: string; views: string; time: string }
  let { channel, text, views, time }: Props = $props();
</script>

<article class="tg">
  <header>{channel}</header>
  <p>{text}</p>
  <footer><span>👁 {views}</span><span>{time}</span></footer>
</article>

<style>
  .tg { background: #1e2a36; color: #fff; border-radius: 14px; padding: 0.9rem 1rem; font-family: var(--font-feed); max-width: 36rem; }
  header { color: #6ab3f3; font-weight: 600; margin-bottom: 0.4rem; }
  p { margin: 0 0 0.6rem; line-height: 1.45; white-space: pre-wrap; }
  footer { display: flex; justify-content: flex-end; gap: 0.8rem; font-size: 0.8rem; opacity: 0.6; }
</style>
