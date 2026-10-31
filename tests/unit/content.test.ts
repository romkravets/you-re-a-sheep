import { describe, it, expect } from 'vitest';
import fixtureJson from '../fixtures/content.min.json';
import { validateContent, loadContent } from '../../src/lib/content';
import { buildSession } from '../../src/lib/session';
import type { Content, Question, ClipSet } from '../../src/lib/types';

const fresh = (): Content => structuredClone(fixtureJson) as unknown as Content;
const qs = (c: Content) => c.episodes.flatMap((e) => e.questions);
const q = (c: Content, id: string): Question => qs(c).find((x) => x.id === id)!;
const sets = (c: Content) => c.episodes.flatMap((e) => e.clipSets);
const set = (c: Content, id: string): ClipSet => sets(c).find((x) => x.id === id)!;

describe('validateContent', () => {
  it('fixture is valid', () => {
    expect(validateContent(fresh())).toEqual([]);
  });

  it('rewrite question must not be a stop question', () => {
    const c = fresh();
    set(c, 's1').questionIds.push('rw1');
    expect(validateContent(c)).toContain('clipset:s1 rewrite question rw1 listed in questionIds');
  });

  it('correct must be an option', () => {
    const c = fresh();
    q(c, 'r1a').correct = 'd';
    expect(validateContent(c)).toContain('q:r1a correct "d" not in options');
  });

  it('enemy needs source and fakeLabel', () => {
    const c = fresh();
    const e = q(c, 't-enemy');
    delete e.source;
    delete e.fakeLabel;
    const errs = validateContent(c);
    expect(errs).toContain('q:t-enemy enemy requires source.url');
    expect(errs).toContain('q:t-enemy enemy requires fakeLabel');
  });

  it('clip set questionIds must exist and be bound once', () => {
    const c = fresh();
    set(c, 's1').questionIds.push('nope');
    expect(validateContent(c)).toContain('clipset:s1 unknown question nope');
    const d = fresh();
    set(d, 's2').questionIds.push('r1a');
    expect(validateContent(d)).toContain('q:r1a bound to multiple clip sets');
  });

  it('clip set sizes', () => {
    const c = fresh();
    set(c, 's1').clips.pop();
    set(c, 's1').questionIds = ['rw1'];
    set(c, 's2').clips.pop();
    set(c, 's2').questionIds = ['r2a'];
    const errs = validateContent(c);
    expect(errs).toContain('clipset:s1 round 1 needs 8 clips, has 7');
    expect(errs).toContain('clipset:s1 round 1 needs at least 3 questions, has 1');
    expect(errs).toContain('clipset:s2 round 2 needs 6 clips, has 5');
    expect(errs).toContain('clipset:s2 round 2 needs at least 2 questions, has 1');
  });

  it('levels cover 0–100 contiguously', () => {
    const c = fresh();
    c.levels.find((l) => l.id === 'molly')!.min = 31;
    expect(validateContent(c)).toContain('levels gap at 30');
  });

  it('vanishSeconds ≤ 30', () => {
    const c = fresh();
    const m = q(c, 't-close-reading').material;
    if (m?.kind === 'text') m.vanishSeconds = 31;
    expect(validateContent(c)).toContain('q:t-close-reading vanishSeconds 31 > 30');
  });

  it('herd hint must point to a wrong option', () => {
    const c = fresh();
    q(c, 't-herd').herd = { option: 'a', percent: 80 };
    expect(validateContent(c)).toContain('q:t-herd herd hint must point to a wrong option');
  });

  it('round-3 questions need why', () => {
    const c = fresh();
    delete q(c, 't-farm').why;
    q(c, 't-motive').why!.correct = 'd';
    q(c, 'r1a').why = { options: [{ id: 'a', text: 'x' }], correct: 'a' };
    const errs = validateContent(c);
    expect(errs).toContain('q:t-farm missing why');
    expect(errs).toContain('q:t-motive why correct "d" not in options');
    expect(errs).toContain('q:r1a recall must not have why');
  });

  it('rewrite binding', () => {
    let c = fresh();
    delete set(c, 's1').rewrite;
    expect(validateContent(c)).toContain('clipset:s1 missing rewrite');

    c = fresh();
    set(c, 's1').rewrite!.clipId = 'zzz';
    expect(validateContent(c)).toContain('clipset:s1 rewrite clip zzz not in set');

    c = fresh();
    const m = q(c, 'rw1').material;
    if (m?.kind === 'rewritten') m.before = 'Інше';
    expect(validateContent(c)).toContain('q:rw1 rewrite before does not match clip overlay');

    c = fresh();
    const m2 = q(c, 'rw1').material;
    if (m2?.kind === 'rewritten') m2.after = m2.before;
    expect(validateContent(c).some((e) => e.startsWith('q:rw1 rewrite before equals after'))).toBe(true);

    c = fresh();
    delete set(c, 's1').rewrite;
    set(c, 's1').questionIds = set(c, 's1').questionIds.filter((x) => x !== 'rw1');
    expect(validateContent(c)).toContain('q:rw1 rewritten question unbound');

    c = fresh();
    set(c, 's2').rewrite = { clipId: 'b1', questionId: 'rw1' };
    expect(validateContent(c)).toContain('clipset:s2 round 2 must not have rewrite');
  });

  it('patterns cover every skill once', () => {
    let c = fresh();
    c.patterns = c.patterns.filter((p) => p.skill !== 'motive');
    expect(validateContent(c)).toContain('patterns missing motive');
    c = fresh();
    c.patterns.push({ skill: 'detail', line: 'ще' });
    expect(validateContent(c)).toContain('patterns duplicate detail');
  });

  it('minimums', () => {
    const errs = validateContent(fresh(), { minimums: true });
    expect(errs).toContain('type herd has 1 questions, need 6');
    expect(errs).toContain('round 1 has 1 clip sets, need 3');
    expect(errs.some((e) => e.startsWith('type rewritten'))).toBe(false);
  });

  it('release rejects placeholder licenses', () => {
    const c = fresh();
    set(c, 's1').clips[0].license.license = 'placeholder';
    expect(validateContent(c)).toEqual([]);
    expect(validateContent(c, { release: true })).toContain('clip:a1 placeholder license');
  });

  it.skip('real content passes minimums', () => {
    expect(validateContent(loadContent(), { minimums: true })).toEqual([]);
  });

  it('pilot content is valid', () => {
    const c = loadContent();
    expect(c.episodes.length).toBeGreaterThan(0);
    expect(c.levels).toHaveLength(5);
    expect(validateContent(c)).toEqual([]);
    for (let seed = 1; seed <= 50; seed++) {
      const s = buildSession(c, seed, undefined, { pilot: true });
      expect(s.rounds).toHaveLength(2);
    }
  });
});
