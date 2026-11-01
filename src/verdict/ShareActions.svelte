<script lang="ts">
  import type { Level } from '../lib/types';
  import { renderStoryCard, shareOrDownload } from '../lib/storycard';

  interface Props { level: Level; percent: number; ui: Record<string, string> }
  let { level, percent, ui }: Props = $props();

  let busy = $state(false);
  let status = $state('');
  // Drawn ahead of the tap: Safari drops the user activation that navigator.share needs
  // if the click handler first awaits font loading and PNG encoding.
  let card: Promise<Blob> | null = null;
  let ready: Blob | null = null;

  function render(): Promise<Blob> {
    const p = renderStoryCard({ level, percent, siteLabel: ui.siteLabel });
    p.then((b) => { if (card === p) ready = b; }, () => { if (card === p) card = null; });
    card = p;
    return p;
  }

  $effect(() => {
    void level; void percent; // re-draw when the result changes
    ready = null;
    render();
  });

  async function challenge() {
    if (busy) return;
    busy = true;
    status = '';
    try {
      const blob = ready ?? (await (card ?? render()));
      const how = await shareOrDownload(blob, `you-re-a-sheep-${level.id}.png`);
      if (how === 'downloaded') status = ui.challengeSaved;
    } catch {
      status = ui.challengeFailed;
    } finally {
      busy = false;
    }
  }
</script>

<div class="share">
  <button type="button" class="challenge" onclick={challenge} aria-busy={busy}>
    {busy ? ui.challengeBusy : ui.challenge}
  </button>
  <p class="status" data-testid="challenge-status" aria-live="polite">{status}</p>
</div>

<style>
  .share { display: grid; gap: 0.4rem; justify-items: start; }
  .challenge {
    font-family: var(--font-poster); font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em;
    font-size: 1.05rem; background: var(--poster-black); color: var(--poster-cream);
    border: 0; border-radius: 10px; padding: 0.9rem 1.4rem; cursor: pointer;
    box-shadow: 4px 4px 0 var(--poster-red);
  }
  .challenge:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--poster-red); }
  .challenge[aria-busy='true'] { opacity: 0.75; cursor: progress; }
  .status { margin: 0; min-height: 1.4em; font-size: 0.95rem; color: var(--ink-soft); }
</style>
