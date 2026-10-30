import { Observer } from 'gsap/Observer';
import { registerGsap } from '../lib/motion';

export interface FeedInputHandlers {
  next(): void;
  prev(): void;
}

const SWIPE_THRESHOLD = 40; // px
const WHEEL_IDLE_MS = 200; // a new wheel gesture starts after this much silence

/** Swipe / wheel / keyboard input for the feed. Returns a cleanup function. */
export function createFeedInput(el: HTMLElement, handlers: FeedInputHandlers): () => void {
  registerGsap();

  // One step per gesture: a long drag crosses the threshold several times.
  let stepped = false;
  // Finger moving up (negative dy) => next clip. Observer: onUp = content dragged up.
  const drag = Observer.create({
    target: el,
    type: 'touch,pointer',
    tolerance: SWIPE_THRESHOLD,
    dragMinimum: 4,
    debounce: false,
    preventDefault: true,
    onPress: () => (stepped = false),
    onUp: () => {
      if (!stepped) (stepped = true), handlers.next();
    },
    onDown: () => {
      if (!stepped) (stepped = true), handlers.prev();
    },
  });

  // Wheel: one step per gesture (trackpad momentum streams events for ~1 s).
  let lastWheel = -Infinity;
  const wheel = Observer.create({
    target: el,
    type: 'wheel',
    preventDefault: true,
    onWheel: (self) => {
      const now = Date.now();
      const fresh = now - lastWheel > WHEEL_IDLE_MS;
      lastWheel = now;
      const dy = self.deltaY;
      if (!fresh || Math.abs(dy) < 2) return;
      if (dy > 0) handlers.next();
      else handlers.prev();
    },
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        handlers.next();
        break;
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        handlers.prev();
        break;
    }
  };
  document.addEventListener('keydown', onKey);

  return () => {
    drag.kill();
    wheel.kill();
    document.removeEventListener('keydown', onKey);
  };
}
