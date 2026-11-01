import { describe, it, expect } from 'vitest';
import { loadContent } from '../../src/lib/content';
import { splitAccent } from '../../src/quiz/press';

describe('splitAccent', () => {
  it('marks *starred* words as accent', () => {
    expect(splitAccent('Лікарі мовчать: *цей продукт* вбиває')).toEqual([
      { text: 'Лікарі мовчать: ', accent: false },
      { text: 'цей продукт', accent: true },
      { text: ' вбиває', accent: false },
    ]);
  });

  it('plain text is one part', () => {
    expect(splitAccent('Зірка зізналась')).toEqual([{ text: 'Зірка зізналась', accent: false }]);
  });

  it('an unclosed star stays literal', () => {
    expect(splitAccent('90% *людей')).toEqual([{ text: '90% *людей', accent: false }]);
  });
});

describe('press content', () => {
  const press = loadContent().press;

  it('has enough pieces for the noise collage', () => {
    expect(press.length).toBeGreaterThanOrEqual(6);
    expect(press.some((p) => p.kind === 'paper')).toBe(true);
    expect(press.some((p) => p.kind === 'channel')).toBe(true);
  });

  it('every piece has its texts', () => {
    for (const p of press) {
      if (p.kind === 'paper') {
        expect(p.masthead.trim(), JSON.stringify(p)).not.toBe('');
        expect(p.headline.trim(), JSON.stringify(p)).not.toBe('');
      } else {
        expect(p.channel.trim(), JSON.stringify(p)).not.toBe('');
        expect(p.text.trim(), JSON.stringify(p)).not.toBe('');
      }
    }
  });
});
