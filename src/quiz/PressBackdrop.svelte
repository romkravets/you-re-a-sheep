<script lang="ts">
  import type { PressItem } from '../lib/types';
  import { splitAccent } from './press';

  interface Props {
    items: PressItem[];
    /** noise: blurred yellow-press pile behind «Стоп»; margins: faint cuttings at the paper's edges. */
    variant: 'noise' | 'margins';
  }
  let { items, variant }: Props = $props();

  // Slot geometry: x as left/right offset, top in %, width in % of the screen (capped), rotation in deg.
  type Slot = { side: 'left' | 'right'; x: string; top: string; w: string; r: number };
  const NOISE: Slot[] = [
    { side: 'left', x: '-6%', top: '1%', w: '58%', r: -7 },
    { side: 'right', x: '-4%', top: '8%', w: '46%', r: 5 },
    { side: 'left', x: '30%', top: '26%', w: '56%', r: 9 },
    { side: 'left', x: '-8%', top: '44%', w: '48%', r: -4 },
    { side: 'right', x: '-6%', top: '52%', w: '50%', r: 6 },
    { side: 'left', x: '4%', top: '70%', w: '60%', r: 3 },
    { side: 'right', x: '-8%', top: '80%', w: '44%', r: -8 },
    { side: 'left', x: '34%', top: '90%', w: '50%', r: -3 },
  ];
  const MARGINS: Slot[] = [
    { side: 'left', x: '-120px', top: '6%', w: '180px', r: -8 },
    { side: 'right', x: '-120px', top: '40%', w: '180px', r: 7 },
    { side: 'left', x: '-120px', top: '74%', w: '180px', r: 5 },
  ];

  const placed = $derived.by(() => {
    const slots = variant === 'noise' ? NOISE : MARGINS;
    const pool = variant === 'noise' ? items : items.filter((p) => p.kind === 'paper');
    return pool.slice(0, slots.length).map((item, i) => ({ item, slot: slots[i], i }));
  });
</script>

<div class="backdrop {variant}" data-testid="press-backdrop" data-variant={variant} aria-hidden="true">
  {#each placed as { item, slot, i } (i)}
    <div
      class="piece {item.kind}"
      data-press-item
      style:--r="{slot.r}deg"
      style:--dur="{14 + (i % 4) * 3}s"
      style:--dx="{i % 2 ? -12 : 10}px"
      style:--dy="{i % 3 ? 8 : -10}px"
      style:width={slot.w}
      style:top={slot.top}
      style:left={slot.side === 'left' ? slot.x : null}
      style:right={slot.side === 'right' ? slot.x : null}
    >
      {#if item.kind === 'paper'}
        <div class="mast">{item.masthead}</div>
        <div class="hl">{#each splitAccent(item.headline) as part}{#if part.accent}<span class="accent">{part.text}</span>{:else}{part.text}{/if}{/each}</div>
        {#if item.body}<p class="body">{item.body}</p>{/if}
      {:else}
        <b class="chan">{item.channel}</b>
        <span class="text">{item.text}</span>
        <span class="views">👁 {item.views} · {item.time}</span>
      {/if}
    </div>
  {/each}
  {#if variant === 'noise'}<div class="shade"></div>{/if}
</div>

<style>
  .backdrop { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
  .piece {
    position: absolute; box-sizing: border-box; max-width: 360px;
    transform: rotate(var(--r));
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  }
  .paper { background: #efe7d2; color: #141414; padding: 0.55rem 0.7rem; font-family: Georgia, 'Times New Roman', serif; }
  .mast {
    font: 900 1.35rem/1 Impact, 'Arial Black', sans-serif; letter-spacing: 0.02em;
    border-bottom: 3px double #141414; padding-bottom: 0.25rem; margin-bottom: 0.35rem;
  }
  .hl { font: 900 1.05rem/1.05 'Arial Black', Impact, sans-serif; text-transform: uppercase; }
  .accent { color: #d01010; }
  .body { font-size: 0.55rem; line-height: 1.3; column-count: 2; column-gap: 0.5rem; color: #333; margin: 0.35rem 0 0; }
  .channel {
    background: #1e2c3a; color: #e8eef4; border-radius: 12px; padding: 0.55rem 0.7rem;
    font: 0.75rem/1.35 system-ui, sans-serif; display: grid; gap: 0.2rem;
  }
  .chan { color: #6ab3f3; }
  .views { justify-self: end; font-size: 0.6rem; opacity: 0.6; }

  /* «Стоп»: blurred noise that slowly drifts; the shade keeps the question readable */
  .noise .piece {
    filter: blur(2.6px); opacity: 0.55;
    animation: drift var(--dur) ease-in-out infinite alternate;
  }
  .shade {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.84) 0%, rgba(0, 0, 0, 0.66) 60%, rgba(0, 0, 0, 0.5) 100%);
  }
  @keyframes drift {
    from { transform: rotate(var(--r)) translate(0, 0); }
    to { transform: rotate(var(--r)) translate(var(--dx), var(--dy)); }
  }

  /* paper: faint grey cuttings, still */
  .margins .piece { filter: grayscale(1) blur(0.8px); opacity: 0.2; box-shadow: none; }

  @media (prefers-reduced-motion: reduce) {
    .noise .piece { animation: none !important; }
  }
</style>
