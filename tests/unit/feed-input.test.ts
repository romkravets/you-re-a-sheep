// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFeedInput } from '../../src/feed/feed-input';

// Observer listens to touch events where the environment supports them (as happy-dom and phones do).
function touch(type: string, y: number): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  const t = { clientX: 100, clientY: y, identifier: 1 };
  Object.assign(e, { touches: type === 'touchend' ? [] : [t], changedTouches: [t] });
  return e;
}
function drag(el: HTMLElement, dy: number) {
  el.dispatchEvent(touch('touchstart', 300));
  for (let i = 1; i <= 6; i++) document.dispatchEvent(touch('touchmove', 300 + (dy * i) / 6));
  document.dispatchEvent(touch('touchend', 300 + dy));
}

describe('createFeedInput', () => {
  let el: HTMLElement;
  let next: ReturnType<typeof vi.fn<() => void>>;
  let prev: ReturnType<typeof vi.fn<() => void>>;
  let cleanup: () => void;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    next = vi.fn<() => void>();
    prev = vi.fn<() => void>();
    cleanup = createFeedInput(el, { next, prev });
  });
  afterEach(() => {
    cleanup();
    el.remove();
  });

  it('drag of -60px calls next', () => {
    drag(el, -60);
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).not.toHaveBeenCalled();
  });

  it('drag of +60px calls prev', () => {
    drag(el, 60);
    expect(prev).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('a long drag (-200px) still advances only one clip', () => {
    drag(el, -200);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('drag of -20px calls nothing', () => {
    drag(el, -20);
    expect(next).not.toHaveBeenCalled();
    expect(prev).not.toHaveBeenCalled();
  });

  it('ArrowDown calls next, ArrowUp calls prev', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(next).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(prev).toHaveBeenCalledTimes(1);
  });

  it('PageDown, PageUp and Space work', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(next).toHaveBeenCalledTimes(2);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    expect(prev).toHaveBeenCalledTimes(1);
  });

  it('Space/Enter on a focused button inside the feed activates the button, not the feed', () => {
    const btn = document.createElement('button');
    const icon = document.createElement('span');
    btn.appendChild(icon);
    el.appendChild(btn);
    for (const key of [' ', 'Enter']) {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      btn.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
      icon.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
    expect(next).not.toHaveBeenCalled();
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('5 wheel events within 300ms call next once', async () => {
    for (let i = 0; i < 5; i++) {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).not.toHaveBeenCalled();
  });

  it('cleanup removes the listeners', () => {
    cleanup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
    drag(el, -60);
    expect(next).not.toHaveBeenCalled();
    expect(prev).not.toHaveBeenCalled();
  });
});
