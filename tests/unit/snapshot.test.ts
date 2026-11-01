// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { releaseFrame, type Frame } from '../../src/crack/snapshot';

function frame(): Frame {
  const canvas = document.createElement('canvas');
  canvas.width = 780;
  canvas.height = 1688;
  return { canvas, width: 390, height: 844, scale: 2 };
}

describe('releaseFrame', () => {
  it('drops the backing store of a frame nothing shows any more', () => {
    const f = frame();
    expect(releaseFrame(f)).toBeNull();
    expect(f.canvas.width).toBe(0);
    expect(f.canvas.height).toBe(0);
  });

  it('keeps a frame that is still on screen (the stand-in fell back to it)', () => {
    const f = frame();
    expect(releaseFrame(f, f)).toBeNull();
    expect(f.canvas.width).toBe(780);
  });

  it('ignores null', () => {
    expect(releaseFrame(null)).toBeNull();
  });
});
