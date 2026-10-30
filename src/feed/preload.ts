import type { Clip } from '../lib/types';

/** Sets preload="auto" on the next 2 videos after `index`; everything else stays "none" (current clip autoplays). */
export function preloadNext(clips: Clip[], index: number): void {
  clips.forEach((clip, i) => {
    const video = document.querySelector<HTMLVideoElement>(`video[data-clip-id="${CSS.escape(clip.id)}"]`);
    if (!video) return;
    const want = i === index + 1 || i === index + 2;
    if (want) video.preload = 'auto';
    else if (i !== index) video.preload = 'none';
  });
}
