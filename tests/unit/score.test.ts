import { describe, it, expect } from 'vitest';
import fixtureJson from '../fixtures/content.min.json';
import { scoreRun, sheepMeter, pluralRaz } from '../../src/lib/score';
import { levelFor } from '../../src/lib/levels';
import type { Answer, Clip, Content, FeedEvent, Question, Session, Skill, TrapKind, Confidence } from '../../src/lib/types';

const content = fixtureJson as unknown as Content;

const opt = (id: 'a' | 'b') => ({ id, text: id });
function q(id: string, skill: Skill = 'detail', withWhy = false): Question {
  return {
    id, type: withWhy ? 'herd' : 'recall', prompt: id, options: [opt('a'), opt('b')], correct: 'a', skill,
    ...(withWhy ? { why: { options: [opt('a'), opt('b')], correct: 'a' as const } } : {}),
    explanation: 'e', verdictLine: `Лінія ${id}.`,
  };
}
function clip(id: string, trap?: TrapKind): Clip {
  return { id, webm: '', mp4: '', poster: '', handle: '', caption: '', likes: '', comments: '', shares: '',
    license: { source: '', url: '', license: 'placeholder' }, ...(trap ? { trap } : {}) };
}
const clips = [clip('fk', 'fake'), clip('cb', 'clickbait'), clip('ad', 'ad'), clip('rg', 'rage'), clip('re', 'real'), clip('fk2', 'fake')];
function sess(qs: Question[]): Session {
  return { seed: 1, rounds: [
    { kind: 'feed', clipSet: { id: 's', round: 1, clips, questionIds: [] }, questions: [] },
    { kind: 'reality', questions: qs },
  ] };
}
const qs = (n: number, skill: Skill = 'detail') => Array.from({ length: n }, (_, i) => q(`q${i}`, skill));
const ans = (qq: Question[], wrongIdx: number[] = [], confidence: Confidence = 'maybe'): Answer[] =>
  qq.map((x, i) => ({ questionId: x.id, chosen: wrongIdx.includes(i) ? 'b' : 'a', confidence }));

describe('scoreRun', () => {
  it('all correct, no events → 100, orwell', () => {
    const Q = qs(10);
    const r = scoreRun(sess(Q), ans(Q), [], content);
    expect(r.percent).toBe(100);
    expect(r.level).toBe('orwell');
    expect(r.verdictLines).toEqual([]);
    expect(r.pattern).toBeNull();
  });
  it('all wrong → 0, sheep', () => {
    const Q = qs(10);
    const r = scoreRun(sess(Q), ans(Q, [...Q.keys()]), [], content);
    expect(r.percent).toBe(0);
    expect(r.level).toBe('sheep');
  });
  it('share on fake costs 5 and adds line', () => {
    const Q = qs(10);
    const r = scoreRun(sess(Q), ans(Q), [{ kind: 'share', clipId: 'fk' }], content);
    expect(r.percent).toBe(95);
    expect(r.verdictLines).toEqual(['Ти переслав фейк.']);
  });
  it('penalty counted once per clip', () => {
    const Q = qs(10);
    const ev: FeedEvent[] = [{ kind: 'share', clipId: 'fk' }, { kind: 'share', clipId: 'fk' }];
    expect(scoreRun(sess(Q), ans(Q), ev, content).percent).toBe(95);
  });
  it('like on real trap costs nothing', () => {
    const Q = qs(10);
    const r = scoreRun(sess(Q), ans(Q), [{ kind: 'like', clipId: 're' }, { kind: 'share', clipId: 're' }], content);
    expect(r.percent).toBe(100);
    expect(r.verdictLines).toEqual([]);
  });
  it('moreTime adds line but no penalty', () => {
    const Q = qs(10);
    const a = ans(Q); a[0].moreTime = true;
    const r = scoreRun(sess(Q), a, [], content);
    expect(r.percent).toBe(100);
    expect(r.verdictLines).toEqual(['Тобі знадобилось більше часу на читання.']);
  });
  it('like on clickbait costs 3, share+like on one clip = 5 total? (share wins, once per clip)', () => {
    const Q = qs(10);
    expect(scoreRun(sess(Q), ans(Q), [{ kind: 'like', clipId: 'cb' }], content).percent).toBe(97);
    const both: FeedEvent[] = [{ kind: 'like', clipId: 'fk' }, { kind: 'share', clipId: 'fk' }];
    expect(scoreRun(sess(Q), ans(Q), both, content).percent).toBe(95);
  });
  it('dwell >= 3000 on clickbait/ad adds line', () => {
    const Q = qs(10);
    const r = scoreRun(sess(Q), ans(Q), [{ kind: 'dwell', clipId: 'ad', ms: 3000 }], content);
    expect(r.verdictLines).toEqual(['Ти завис на клікбейті.']);
    const r2 = scoreRun(sess(Q), ans(Q), [{ kind: 'dwell', clipId: 'ad', ms: 2999 }, { kind: 'dwell', clipId: 'fk', ms: 9000 }], content);
    expect(r2.verdictLines).toEqual([]);
  });
  it('verdict lines capped at 4 and ordered as specified', () => {
    const Q = qs(10, 'detail');
    const a = ans(Q, [0, 1], 'sure'); a[2].moreTime = true;
    const ev: FeedEvent[] = [{ kind: 'share', clipId: 'fk' }, { kind: 'share', clipId: 'rg' }];
    const r = scoreRun(sess(Q), a, ev, content);
    expect(r.verdictLines).toEqual([
      'Ти був певен — і помилився 2 рази.',
      'Лінія q0.',
      'Лінія q1.',
      'Ти переслав фейк.',
    ]);
  });
  it('orders lucky guess, rage, like, dwell, moreTime when no wrong answers', () => {
    const Q = [q('w', 'detail', true), ...qs(9)].map((x, i) => (i === 0 ? x : { ...x, id: `z${i}` }));
    const a = ans(Q); a[0].whyChosen = 'b'; a[1].moreTime = true;
    const ev: FeedEvent[] = [{ kind: 'share', clipId: 'rg' }, { kind: 'like', clipId: 'cb' }, { kind: 'dwell', clipId: 'cb', ms: 4000 }];
    const r = scoreRun(sess(Q), a, ev, content);
    expect(r.verdictLines).toEqual([
      'Ти вгадав, але не знав чому.',
      'Тебе розлютили — і ти поширив.',
      'Ти лайкнув клікбейт.',
      'Ти завис на клікбейті.',
    ]);
  });
  it('lucky guess scores 5', () => {
    const Q = [q('w', 'detail', true), ...qs(9).map((x, i) => ({ ...x, id: `z${i}` }))];
    const a = ans(Q); a[0].whyChosen = 'b';
    const r = scoreRun(sess(Q), a, [], content);
    expect(r.percent).toBe(95);
    expect(r.verdictLines).toEqual(['Ти вгадав, але не знав чому.']);
    a[0].whyChosen = 'a';
    expect(scoreRun(sess(Q), a, [], content).percent).toBe(100);
  });
  it('confidence does not change points', () => {
    const Q = qs(10);
    const g = scoreRun(sess(Q), ans(Q, [0, 3], 'guess'), [], content);
    const s = scoreRun(sess(Q), ans(Q, [0, 3], 'sure'), [], content);
    expect(g.percent).toBe(s.percent);
    expect(g.percent).toBe(80);
  });
  it('confident wrong counted and first', () => {
    const Q = qs(10);
    const r = scoreRun(sess(Q), ans(Q, [0, 1, 2], 'sure'), [], content);
    expect(r.confidentWrong).toBe(3);
    expect(r.verdictLines[0]).toBe('Ти був певен — і помилився 3 рази.');
  });
  it('plural forms', () => {
    expect(pluralRaz(1)).toBe('раз');
    expect(pluralRaz(5)).toBe('разів');
    expect(pluralRaz(11)).toBe('разів');
    expect(pluralRaz(21)).toBe('раз');
    expect(pluralRaz(22)).toBe('рази');
    expect(pluralRaz(14)).toBe('разів');
  });
  it('pattern needs 2 misses', () => {
    const Q = [q('a', 'herd'), q('b', 'detail'), q('c', 'detail')];
    expect(scoreRun(sess(Q), ans(Q, [0]), [], content).pattern).toBeNull();
    const Q2 = [q('a', 'herd'), q('b', 'herd'), q('c', 'detail')];
    expect(scoreRun(sess(Q2), ans(Q2, [0, 1]), [], content).pattern).toBe('herd');
  });
  it('feed penalties count toward pattern', () => {
    const Q = [q('a', 'source'), q('b', 'detail')];
    const r = scoreRun(sess(Q), ans(Q, [0]), [{ kind: 'share', clipId: 'fk' }], content);
    expect(r.pattern).toBe('source');
  });
  it('trap kinds map to skills', () => {
    const Q = [q('a', 'herd')];
    const cb: FeedEvent[] = [{ kind: 'like', clipId: 'cb' }, { kind: 'like', clipId: 'cb' }, { kind: 'share', clipId: 'cb' }];
    expect(scoreRun(sess(Q), ans(Q), cb, content).pattern).toBeNull(); // one clip = one miss
    const two: FeedEvent[] = [{ kind: 'like', clipId: 'cb' }, { kind: 'like', clipId: 'ad' }, { kind: 'like', clipId: 'rg' }];
    expect(scoreRun(sess(Q), ans(Q), two, content).pattern).toBe('motive');
  });
  it('pattern tie goes to earlier skill', () => {
    const Q = [q('a', 'motive'), q('b', 'motive'), q('c', 'detail'), q('d', 'detail')];
    expect(scoreRun(sess(Q), ans(Q, [0, 1, 2, 3]), [], content).pattern).toBe('detail');
  });
  it('sets at from injected now', () => {
    const Q = qs(1);
    expect(scoreRun(sess(Q), ans(Q), [], content, new Date('2026-01-02T03:04:05Z')).at).toBe('2026-01-02T03:04:05.000Z');
  });
});

describe('sheepMeter', () => {
  it('starts at 0 and is 100 after one wrong answer', () => {
    const Q = qs(10);
    expect(sheepMeter(sess(Q), [], [])).toBe(0);
    expect(sheepMeter(sess(Q), ans(Q.slice(0, 1), [0]), [])).toBe(100);
    expect(sheepMeter(sess(Q), ans(Q.slice(0, 2), [0]), [])).toBe(50);
  });
  it('counts penalties and lucky guesses', () => {
    const Q = [q('w', 'detail', true), ...qs(3).map((x, i) => ({ ...x, id: `z${i}` }))];
    const a = ans(Q.slice(0, 1)); a[0].whyChosen = 'b';
    expect(sheepMeter(sess(Q), a, [])).toBe(50);
    expect(sheepMeter(sess(Q), [], [{ kind: 'share', clipId: 'fk' }])).toBe(100);
  });
});

describe('levelFor', () => {
  it('boundaries', () => {
    const L = content.levels;
    const id = (p: number) => levelFor(p, L).id;
    expect([29, 30, 49, 50, 69, 70, 89, 90, 100, -3].map(id)).toEqual(
      ['sheep', 'molly', 'molly', 'boxer', 'boxer', 'benjamin', 'benjamin', 'orwell', 'orwell', 'sheep']);
  });
});
