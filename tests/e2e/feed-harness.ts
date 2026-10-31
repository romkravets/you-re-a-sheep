import { mount } from 'svelte';
import '../../src/styles/tokens.css';
import '../../src/styles/base.css';
import Feed from '../../src/feed/Feed.svelte';
import type { Clip, ClipSet, FeedEvent } from '../../src/lib/types';

// Fixture clips live under tests/ and are bundled only into the test-mode harness, never into dist/ of production.
const files = import.meta.glob<string>('../fixtures/clips/ph-*', { eager: true, query: '?url', import: 'default' });
const url = (name: string) => files[`../fixtures/clips/${name}`];

const clips: Clip[] = Array.from({ length: 8 }, (_, i) => ({
  id: `ph-${i + 1}`,
  webm: url(`ph-${i + 1}.webm`),
  mp4: url(`ph-${i + 1}.mp4`),
  poster: url(`ph-${i + 1}.jpg`),
  handle: `user_${i + 1}`,
  caption: `Підпис до кліпу ${i + 1} #fyp`,
  likes: '12.4K',
  comments: '318',
  shares: '1.2K',
  overlay: i === 1 ? 'Науковці вперше підтвердили...' : undefined,
  license: { source: 'placeholder', url: '', license: 'placeholder' },
}));
const clipSet: ClipSet = { id: 'harness', round: 1, clips, questionIds: [] };

const w = window as unknown as Record<string, unknown>;
w.__events = [] as FeedEvent[];
w.__done = false;

const feed = mount(Feed, {
  target: document.getElementById('app')!,
  props: {
    clipSet,
    onevent: (e: FeedEvent) => (w.__events as FeedEvent[]).push(e),
    ondone: () => (w.__done = true),
  },
}) as { currentIndex(): number; next(): void; prev(): void };
w.__feed = { index: () => feed.currentIndex() };
