import { mount, unmount } from 'svelte';
import '../../src/styles/tokens.css';
import '../../src/styles/base.css';
import Feed from '../../src/feed/Feed.svelte';
import Crack from '../../src/crack/Crack.svelte';
import { snapshotFeed, stopStandIn } from '../../src/crack/snapshot';
import type { Clip, ClipSet } from '../../src/lib/types';

// Test-mode-only entry (see vite.config.ts): the real feed, snapshotted and shattered over a paper page.
const files = import.meta.glob<string>('../fixtures/clips/ph-*', { eager: true, query: '?url', import: 'default' });
const url = (name: string) => files[`../fixtures/clips/${name}`];

const clips: Clip[] = Array.from({ length: 3 }, (_, i) => ({
  id: `ph-${i + 1}`,
  webm: url(`ph-${i + 1}.webm`),
  mp4: url(`ph-${i + 1}.mp4`),
  poster: url(`ph-${i + 1}.jpg`),
  handle: `user_${i + 1}`,
  caption: `Підпис до кліпу ${i + 1} #fyp`,
  likes: '12.4K',
  comments: '318',
  shares: '1.2K',
  overlay: i === 0 ? 'Науковці вперше підтвердили...' : undefined,
  license: { source: 'placeholder', url: '', license: 'placeholder' },
}));
const clipSet: ClipSet = { id: 'harness', round: 1, clips, questionIds: [] };

const w = window as unknown as Record<string, unknown>;
w.__done = false;

const feed = mount(Feed, {
  target: document.getElementById('feed-root')!,
  props: { clipSet, onevent: () => {}, ondone: () => {} },
});

w.__crack = (variant: 'stop' | 'feed-to-paper') => {
  const feedEl = document.querySelector<HTMLElement>('[data-testid="feed"]')!;
  const shot = snapshotFeed(feedEl);
  const source = variant === 'feed-to-paper' ? stopStandIn(shot) : shot;
  unmount(feed);
  document.getElementById('paper')!.hidden = false;
  const t0 = performance.now();
  const crack = mount(Crack, {
    target: document.getElementById('crack-root')!,
    props: {
      source,
      variant,
      impact: { x: innerWidth * 0.52, y: innerHeight * 0.46 },
      ondone: () => {
        w.__doneAt = performance.now() - t0;
        w.__done = true;
        queueMicrotask(() => unmount(crack));
      },
    },
  });
};
