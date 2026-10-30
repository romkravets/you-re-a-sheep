<script lang="ts">
  import type { Clip } from '../lib/types';

  interface Props {
    clip: Clip;
    active: boolean;
    muted: boolean;
    showHint?: boolean;
    onlike: () => void;
    onshare: () => void;
    onunmute: () => void;
    ontogglesound: () => void;
    onglow: (color: string) => void;
  }
  let { clip, active, muted, showHint = false, onlike, onshare, onunmute, ontogglesound, onglow }: Props = $props();

  let video: HTMLVideoElement | undefined = $state();
  let playing = $state(false);
  let failed = $state(false);
  let liked = $state(false);
  let shared = $state(false);

  const toggleLike = () => {
    liked = !liked;
    if (liked) onlike();
  };
  const toggleShare = () => {
    shared = !shared;
    if (shared) onshare();
  };

  // Play only the active clip; a rejected play() just leaves the poster up.
  $effect(() => {
    if (!video) return;
    if (active && !failed) {
      video.currentTime = 0;
      video.play().catch((err: unknown) => {
        // pause() from a fast swipe rejects play() with AbortError: not a real failure.
        if ((err as { name?: string })?.name !== 'AbortError') failed = true;
      });
    } else {
      video.pause();
    }
  });
  $effect(() => {
    if (video) video.muted = muted;
  });

  // Average poster colour into --glow via a 1x1 canvas, once per clip.
  function onPosterLoad(e: Event) {
    try {
      const img = e.currentTarget as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      onglow(`rgb(${r}, ${g}, ${b})`);
    } catch {
      /* canvas tainted or unavailable: keep default glow */
    }
  }

  // A tap (not a swipe) on the clip unmutes the first time.
  let downY = 0;
  let downX = 0;
  const onDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if ((e.target as Element).closest('button')) return;
    if (muted && Math.hypot(e.clientX - downX, e.clientY - downY) < 10) onunmute();
  };
</script>

<article class="clip" data-testid={`clip-${clip.id}`} aria-hidden={!active}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="stage" onpointerdown={onDown} onpointerup={onUp}>
    <img
      class="poster"
      data-testid={`poster-${clip.id}`}
      src={clip.poster}
      alt=""
      draggable="false"
      onload={onPosterLoad}
    />
    {#if !failed}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={video}
        data-clip-id={clip.id}
        class:on={playing}
        playsinline
        muted
        loop
        autoplay={active}
        preload="none"
        poster={clip.poster}
        onplaying={() => (playing = true)}
        onerror={() => (failed = true)}
      >
        <source src={clip.webm} type="video/webm" onerror={() => {}} />
        <source src={clip.mp4} type="video/mp4" onerror={() => (failed = true)} />
      </video>
    {/if}
    <div class="shade"></div>

    {#if clip.overlay}
      <div class="overlay" data-testid="overlay">{clip.overlay}</div>
    {/if}

    {#if showHint}
      <div class="hint" data-testid="hint">↑ ↓ / коліщатко</div>
    {/if}

    <div class="rail">
      <button type="button" class="act" class:on={liked} data-testid="like" aria-pressed={liked} aria-label="Подобається" onclick={toggleLike}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 2.7 4.5 6.4 4.5c2 0 3.7 1.1 5.6 3.3 1.9-2.2 3.6-3.3 5.6-3.3 3.7 0 5.5 3.800 4 7.300C19.500 16.400 12 21 12 21z"/></svg>
        <span>{clip.likes}</span>
      </button>
      <button type="button" class="act" data-testid="comment" aria-label="Коментарі">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 0-1z"/></svg>
        <span>{clip.comments}</span>
      </button>
      <button type="button" class="act" class:on={shared} data-testid="share" aria-pressed={shared} aria-label="Поділитись" onclick={toggleShare}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 3 10.500l6.500 2.500L12 20z"/></svg>
        <span>{clip.shares}</span>
      </button>
      <button type="button" class="act sound" data-testid="sound" aria-label={muted ? 'Увімкнути звук' : 'Вимкнути звук'} onclick={() => ontogglesound()}>
        {#if muted}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.500 3 2.500-2.500-1.400-1.400L15 10.600l-2.500-2.500-1.400 1.400L13.600 12l-2.500 2.500 1.400 1.400L15 13.400l2.500 2.500 1.400-1.400z"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13 3a4 4 0 0 0-2-3.500v7A4 4 0 0 0 16 12z"/></svg>
        {/if}
      </button>
    </div>

    <div class="meta">
      <div class="handle">@{clip.handle}</div>
      <div class="caption">{clip.caption}</div>
    </div>
  </div>
</article>

<style>
  .clip {
    position: relative;
    flex: 0 0 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
    color: var(--feed-ui);
    font-family: var(--font-feed);
  }
  .stage {
    position: absolute;
    inset: 0;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .poster,
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }
  video {
    opacity: 0;
  }
  video.on {
    opacity: 1;
  }
  .shade {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0) 38%),
      linear-gradient(to bottom, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0) 16%);
  }
  .overlay {
    position: absolute;
    left: 6%;
    right: 22%;
    top: 30%;
    padding: 0.7em 0.9em;
    background: rgba(0, 0, 0, 0.62);
    border-left: 4px solid var(--neon-pink);
    border-radius: 4px;
    font-weight: 700;
    font-size: clamp(16px, 4.6cqh, 26px);
    line-height: 1.25;
    pointer-events: none;
  }
  .hint {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 99px;
    background: rgba(0, 0, 0, 0.45);
    color: rgba(255, 255, 255, 0.75);
    display: none;
    pointer-events: none;
  }
  @media (min-width: 900px) {
    .hint {
      display: block;
    }
  }
  .rail {
    position: absolute;
    right: 8px;
    bottom: calc(96px + env(safe-area-inset-bottom, 0px));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }
  .act {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 44px;
    min-height: 44px;
    font-size: 12px;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }
  .act:focus-visible {
    outline: 2px solid var(--neon-cyan);
    outline-offset: 2px;
    border-radius: 8px;
  }
  .act svg {
    width: 32px;
    height: 32px;
    fill: #fff;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.55));
    transition: transform 0.18s;
  }
  .act.on svg {
    fill: var(--neon-pink);
    transform: scale(1.18);
  }
  .sound svg {
    width: 26px;
    height: 26px;
  }
  .meta {
    position: absolute;
    left: 12px;
    right: 72px;
    bottom: calc(22px + env(safe-area-inset-bottom, 0px));
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }
  .handle {
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 4px;
  }
  .caption {
    font-size: 14px;
    line-height: 1.3;
  }
  @media (prefers-reduced-motion: reduce) {
    .act svg {
      transition: none;
    }
  }
</style>
