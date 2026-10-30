import { mount } from 'svelte';
import '../../src/styles/tokens.css';
import '../../src/styles/base.css';
import Feed from '../../src/feed/Feed.svelte';
import type { Clip, ClipSet, FeedEvent } from '../../src/lib/types';

const clips: Clip[] = Array.from({ length: 8 }, (_, i) => ({
  id: `ph-${i + 1}`,
  webm: `/clips/ph-${i + 1}.webm`,
  mp4: `/clips/ph-${i + 1}.mp4`,
  poster: `/clips/ph-${i + 1}.jpg`,
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
