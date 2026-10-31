import { describe, it, expect } from 'vitest';
import fixtureJson from '../fixtures/content.min.json';
import { buildSession } from '../../src/lib/session';
import { makeRng, shuffle } from '../../src/lib/rng';
import type { Content, ClipSet, Question, RealityRound, SessionRound } from '../../src/lib/types';

const base = (): Content => structuredClone(fixtureJson) as unknown as Content;

/** Fixture extended to 3 sets per round and 6 questions per round-3 type. */
function big(): Content {
  const c = base();
  const ep = c.episodes[0];
  const [s1, s2] = ep.clipSets;
  const rw = ep.questions.find((q) => q.id === 'rw1')!;
  const clone = (q: Question, id: string): Question => ({ ...structuredClone(q), id });
  const extraQs: Question[] = [];
  const extraSets: ClipSet[] = [];
  for (const n of [2, 3]) {
    const rwN = clone(rw, `rw${n}`);
    extraQs.push(rwN);
    const mk = (s: ClipSet): ClipSet => {
      const qids = s.questionIds.map((id) => {
        extraQs.push(clone(ep.questions.find((q) => q.id === id)!, `${id}-${n}`));
        return `${id}-${n}`;
      });
      return {
        ...structuredClone(s),
        id: `${s.id}-${n}`,
        questionIds: qids,
        rewrite: s.rewrite && { ...s.rewrite, questionId: rwN.id },
      };
    };
    extraSets.push(mk(s1), mk(s2));
  }
  ep.clipSets.push(...extraSets);
  ep.questions.push(...extraQs);
  const types = new Set(ep.questions.filter((q) => !['recall', 'rewritten'].includes(q.type)).map((q) => q.type));
  for (const t of types) {
    const src = ep.questions.find((q) => q.type === t)!;
    for (let i = 2; i <= 6; i++) ep.questions.push(clone(src, `${src.id}-x${i}`));
  }
  return c;
}

const sets = (c: Content) => c.episodes.flatMap((e) => e.clipSets);
const reality = (s: { rounds: Array<SessionRound | RealityRound> }) => s.rounds[s.rounds.length - 1] as RealityRound;

describe('rng', () => {
  it('is deterministic and in [0,1)', () => {
    const a = makeRng(7), b = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('shuffle keeps elements', () => {
    expect(shuffle([1, 2, 3, 4, 5], makeRng(1)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('buildSession', () => {
  const c = big();

  it('deterministic', () => {
    expect(buildSession(c, 42)).toEqual(buildSession(c, 42));
  });

  it('round shapes', () => {
    const s = buildSession(c, 1);
    const [r0, r1, r2] = s.rounds as [SessionRound, SessionRound, RealityRound];
    expect(r0.clipSet.clips).toHaveLength(8);
    expect(r0.questions).toHaveLength(3);
    expect(r1.clipSet.clips).toHaveLength(6);
    expect(r1.questions).toHaveLength(2);
    expect(r2.questions).toHaveLength(5);
  });

  it('feed questions belong to their set', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const r of buildSession(c, seed).rounds.slice(0, 2) as SessionRound[]) {
        for (const q of r.questions) expect(r.clipSet.questionIds).toContain(q.id);
      }
    }
  });

  it('round 3 always has farm, enemy and the rewrite', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = buildSession(c, seed);
      const qs = reality(s).questions;
      const rid = (s.rounds[0] as SessionRound).clipSet.rewrite!.questionId;
      expect(qs.filter((q) => q.type === 'farm')).toHaveLength(1);
      expect(qs.filter((q) => q.type === 'enemy')).toHaveLength(1);
      expect(qs.filter((q) => q.id === rid)).toHaveLength(1);
      expect(qs[0].id).not.toBe(rid);
      const others = qs.filter((q) => !['farm', 'enemy', 'rewritten'].includes(q.type));
      expect(others).toHaveLength(2);
      expect(new Set(others.map((q) => q.type)).size).toBe(2);
      expect(others.some((q) => q.type === 'recall')).toBe(false);
    }
  });

  it('bound questions never appear in round 3', () => {
    const bound = new Set(sets(c).flatMap((s) => s.questionIds));
    for (let seed = 0; seed < 200; seed++) {
      const s = buildSession(c, seed);
      const rid = (s.rounds[0] as SessionRound).clipSet.rewrite!.questionId;
      for (const q of reality(s).questions) if (q.id !== rid) expect(bound.has(q.id)).toBe(false);
    }
  });

  it('prefers unseen', () => {
    const farms = c.episodes.flatMap((e) => e.questions).filter((q) => q.type === 'farm').map((q) => q.id);
    const keep = farms[3];
    const seen = new Set(farms.filter((id) => id !== keep));
    for (let seed = 0; seed < 30; seed++) {
      const q = reality(buildSession(c, seed, seen)).questions.find((x) => x.type === 'farm')!;
      expect(q.id).toBe(keep);
    }
    const allSeen = new Set(farms);
    const q = reality(buildSession(c, 1, allSeen)).questions.find((x) => x.type === 'farm')!;
    expect(farms).toContain(q.id);
  });

  it('options shuffled but correct preserved', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      for (const q of (buildSession(c, seed).rounds[0] as SessionRound).questions) {
        const orig = c.episodes.flatMap((e) => e.questions).find((x) => x.id === q.id)!;
        expect(q.options.find((o) => o.id === q.correct)!.text)
          .toBe(orig.options.find((o) => o.id === orig.correct)!.text);
        if (q.id === 'r1a') orders.add(q.options.map((o) => o.id).join(''));
      }
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('prefers unseen stop questions within the set', () => {
    const p = base();
    const ep = p.episodes[0];
    ep.clipSets = ep.clipSets.filter((s) => s.round === 1);
    ep.questions.push({ ...structuredClone(ep.questions.find((q) => q.id === 'r1b')!), id: 'r1d' });
    ep.clipSets[0].questionIds.push('r1d');
    const seen = new Set(['r1a', 'r1b', 'r1c']);
    for (let seed = 0; seed < 50; seed++) {
      const ids = (buildSession(p, seed, seen, { pilot: true }).rounds[0] as SessionRound).questions.map((q) => q.id);
      expect(ids).toContain('r1d');
    }
  });

  it('pilot session shape', () => {
    const p = base();
    const ep = p.episodes[0];
    ep.clipSets = ep.clipSets.filter((s) => s.round === 1);
    ep.questions = ep.questions.filter((q) => q.type !== 'enemy');
    const run = (seed: number) => buildSession(p, seed, new Set(), { pilot: true });
    for (let seed = 0; seed < 20; seed++) {
      const s = run(seed);
      expect(s.rounds).toHaveLength(2);
      const [r0, r1] = s.rounds as [SessionRound, RealityRound];
      expect(r0.clipSet.clips).toHaveLength(8);
      expect(r0.questions).toHaveLength(3);
      expect(r1.kind).toBe('reality');
      expect(r1.questions.map((q) => q.type === 'rewritten' ? q.id : q.type)).toEqual([r0.clipSet.rewrite!.questionId, 'herd', 'farm']);
    }
    expect(run(5)).toEqual(run(5));
  });
});
