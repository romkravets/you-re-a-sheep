import type { ClipSet, Content, Question, RealityRound, Round3Type, Session, SessionRound } from './types';
import { makeRng, shuffle } from './rng';

const FEED_QUESTIONS: Record<1 | 2, number> = { 1: 3, 2: 2 };
const FILLER_TYPES: Round3Type[] = [
  'fake-or-true', 'answer-in-front', 'headline-vs-text', 'herd', 'motive', 'close-reading', 'newspeak',
];

type Rnd = () => number;

function pick<T>(xs: readonly T[], rnd: Rnd): T {
  return xs[Math.floor(rnd() * xs.length)];
}

function withShuffledOptions(q: Question, rnd: Rnd): Question {
  return { ...q, options: shuffle(q.options, rnd) };
}

export function buildSession(
  content: Content,
  seed: number,
  seenQuestionIds: ReadonlySet<string> = new Set(),
  opts: { pilot?: boolean } = {},
): Session {
  const rnd = makeRng(seed);
  const allSets = content.episodes.flatMap((e) => e.clipSets);
  const byId = new Map(content.episodes.flatMap((e) => e.questions).map((q) => [q.id, q]));
  const bound = new Set(allSets.flatMap((s) => s.questionIds));
  const unbound = [...byId.values()].filter((q) => !bound.has(q.id));

  const feedQuestionIds = (s: ClipSet) => s.questionIds.filter((id) => id !== s.rewrite?.questionId);

  const pickSet = (round: 1 | 2): ClipSet => {
    const sets = allSets.filter((s) => s.round === round);
    if (sets.length === 0) throw new Error(`no clip sets for round ${round}`);
    const unseen = (s: ClipSet) => feedQuestionIds(s).filter((id) => !seenQuestionIds.has(id)).length;
    const best = Math.max(...sets.map(unseen));
    return pick(sets.filter((s) => unseen(s) === best), rnd);
  };

  const feedRound = (round: 1 | 2): SessionRound => {
    const clipSet = pickSet(round);
    const ids = shuffle(feedQuestionIds(clipSet), rnd);
    const ordered = [...ids.filter((id) => !seenQuestionIds.has(id)), ...ids.filter((id) => seenQuestionIds.has(id))];
    if (ordered.length < FEED_QUESTIONS[round]) {
      throw new Error(`clip set ${clipSet.id} has ${ordered.length} stop questions, needs ${FEED_QUESTIONS[round]}`);
    }
    const questions = ordered
      .slice(0, FEED_QUESTIONS[round])
      .map((id) => withShuffledOptions(byId.get(id)!, rnd));
    return { kind: 'feed', clipSet, questions };
  };

  const pickOfType = (type: Round3Type): Question => {
    const pool = unbound.filter((q) => q.type === type);
    if (pool.length === 0) throw new Error(`no unbound question of type ${type}`);
    const fresh = pool.filter((q) => !seenQuestionIds.has(q.id));
    return pick(fresh.length ? fresh : pool, rnd);
  };

  const round1 = feedRound(1);
  const rewriteId = round1.clipSet.rewrite?.questionId;
  const rewrite = rewriteId ? byId.get(rewriteId) : undefined;
  if (!rewrite) throw new Error(`clip set ${round1.clipSet.id} has no rewrite question`);

  let reality: RealityRound;
  if (opts.pilot) {
    reality = {
      kind: 'reality',
      questions: [rewrite, pickOfType('herd'), pickOfType('farm')].map((q) => withShuffledOptions(q, rnd)),
    };
    const hasRound2 = allSets.some((c) => c.round === 2);
    return { seed, rounds: hasRound2 ? [round1, feedRound(2), reality] : [round1, reality] };
  }

  const round2 = feedRound(2);
  const available = FILLER_TYPES.filter((t) => unbound.some((q) => q.type === t));
  const hasFresh = (t: Round3Type) => unbound.some((q) => q.type === t && !seenQuestionIds.has(q.id));
  const shuffled = shuffle(available, rnd);
  const types = [...shuffled.filter(hasFresh), ...shuffled.filter((t) => !hasFresh(t))].slice(0, 2);
  if (types.length < 2) throw new Error('not enough round-3 question types');

  const five = shuffle([pickOfType('farm'), pickOfType('enemy'), rewrite, ...types.map(pickOfType)], rnd);
  if (five[0].id === rewrite.id) {
    const j = 1 + Math.floor(rnd() * (five.length - 1));
    [five[0], five[j]] = [five[j], five[0]];
  }
  reality = { kind: 'reality', questions: five.map((q) => withShuffledOptions(q, rnd)) };
  return { seed, rounds: [round1, round2, reality] };
}
