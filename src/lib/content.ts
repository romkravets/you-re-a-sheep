import type { Content, Episode, Level, Fact, Pattern, Question, Round3Type, Skill } from './types';

const SKILLS: Skill[] = ['detail', 'source', 'herd', 'motive'];
const ROUND3_TYPES: Round3Type[] = ['fake-or-true', 'answer-in-front', 'headline-vs-text',
  'herd', 'motive', 'close-reading', 'farm', 'enemy', 'newspeak', 'rewritten'];
const MIN_PER_TYPE = 6;
const MIN_CLIP_SETS = 3;
const ROUND_RULES = { 1: { clips: 8, questions: 3 }, 2: { clips: 6, questions: 2 } } as const;

export interface ValidateOptions { release?: boolean; minimums?: boolean }

export function validateContent(c: Content, opts: ValidateOptions = {}): string[] {
  const errs: string[] = [];
  const questions = c.episodes.flatMap((e) => e.questions);
  const clipSets = c.episodes.flatMap((e) => e.clipSets);
  const qById = new Map(questions.map((q) => [q.id, q]));

  for (const q of questions) checkQuestion(q, errs);
  checkClipSets(clipSets, qById, errs);
  checkRewrittenBound(questions, clipSets, errs);
  checkLevels(c.levels, errs);
  checkPatterns(c.patterns, errs);

  if (opts.minimums) {
    for (const t of ROUND3_TYPES) {
      if (t === 'rewritten') continue; // one per round-1 clip set instead
      const n = questions.filter((q) => q.type === t).length;
      if (n < MIN_PER_TYPE) errs.push(`type ${t} has ${n} questions, need ${MIN_PER_TYPE}`);
    }
    for (const round of [1, 2] as const) {
      const n = clipSets.filter((s) => s.round === round).length;
      if (n < MIN_CLIP_SETS) errs.push(`round ${round} has ${n} clip sets, need ${MIN_CLIP_SETS}`);
    }
  }

  if (opts.release) {
    for (const s of clipSets) {
      for (const clip of s.clips) {
        if (clip.license.license === 'placeholder') errs.push(`clip:${clip.id} placeholder license`);
      }
    }
  }
  return errs;
}

function checkQuestion(q: Question, errs: string[]): void {
  const ids = q.options.map((o) => o.id);
  if (!ids.includes(q.correct)) errs.push(`q:${q.id} correct "${q.correct}" not in options`);

  if (q.type === 'enemy') {
    if (!q.source?.url) errs.push(`q:${q.id} enemy requires source.url`);
    if (!q.fakeLabel) errs.push(`q:${q.id} enemy requires fakeLabel`);
  }

  if (q.material?.kind === 'text' && q.material.vanishSeconds > 30) {
    errs.push(`q:${q.id} vanishSeconds ${q.material.vanishSeconds} > 30`);
  }

  if (q.herd && (q.herd.option === q.correct || !ids.includes(q.herd.option))) {
    errs.push(`q:${q.id} herd hint must point to a wrong option`);
  }

  if (q.type === 'recall') {
    if (q.why) errs.push(`q:${q.id} recall must not have why`);
  } else if (!q.why) {
    errs.push(`q:${q.id} missing why`);
  } else if (!q.why.options.some((o) => o.id === q.why!.correct)) {
    errs.push(`q:${q.id} why correct "${q.why.correct}" not in options`);
  }
}

function checkClipSets(clipSets: Episode['clipSets'], qById: Map<string, Question>, errs: string[]): void {
  const boundTo = new Map<string, number>();
  for (const s of clipSets) {
    const rule = ROUND_RULES[s.round];
    if (s.clips.length !== rule.clips) {
      errs.push(`clipset:${s.id} round ${s.round} needs ${rule.clips} clips, has ${s.clips.length}`);
    }
    if (s.questionIds.length < rule.questions) {
      errs.push(`clipset:${s.id} round ${s.round} needs at least ${rule.questions} questions, has ${s.questionIds.length}`);
    }
    for (const qid of s.questionIds) {
      if (!qById.has(qid)) errs.push(`clipset:${s.id} unknown question ${qid}`);
      boundTo.set(qid, (boundTo.get(qid) ?? 0) + 1);
    }

    if (s.round === 2) {
      if (s.rewrite) errs.push(`clipset:${s.id} round 2 must not have rewrite`);
      continue;
    }
    if (!s.rewrite) {
      errs.push(`clipset:${s.id} missing rewrite`);
      continue;
    }
    const clip = s.clips.find((x) => x.id === s.rewrite!.clipId);
    if (!clip) errs.push(`clipset:${s.id} rewrite clip ${s.rewrite.clipId} not in set`);
    const rq = qById.get(s.rewrite.questionId);
    if (!rq) {
      errs.push(`clipset:${s.id} unknown question ${s.rewrite.questionId}`);
    } else if (rq.type !== 'rewritten' || rq.material?.kind !== 'rewritten') {
      errs.push(`q:${rq.id} rewrite question must be type rewritten with rewritten material`);
    } else {
      if (clip && rq.material.before !== clip.overlay) errs.push(`q:${rq.id} rewrite before does not match clip overlay`);
      if (rq.material.before === rq.material.after) errs.push(`q:${rq.id} rewrite before equals after`);
    }
  }
  for (const [qid, n] of boundTo) {
    if (n > 1) errs.push(`q:${qid} bound to multiple clip sets`);
  }
}

function checkRewrittenBound(questions: Question[], clipSets: Episode['clipSets'], errs: string[]): void {
  const referenced = new Set(clipSets.map((s) => s.rewrite?.questionId));
  for (const q of questions) {
    if (q.type === 'rewritten' && !referenced.has(q.id)) errs.push(`q:${q.id} rewritten question unbound`);
  }
}

function checkLevels(levels: Level[], errs: string[]): void {
  const sorted = [...levels].sort((a, b) => a.min - b.min);
  let next = 0;
  for (const l of sorted) {
    if (l.min > next) errs.push(`levels gap at ${next}`);
    else if (l.min < next) errs.push(`levels overlap at ${l.min}`);
    next = Math.max(next, l.max + 1);
  }
  if (next !== 101) errs.push(`levels end at ${next - 1}, need 100`);
}

function checkPatterns(patterns: Pattern[], errs: string[]): void {
  for (const skill of SKILLS) {
    const n = patterns.filter((p) => p.skill === skill).length;
    if (n === 0) errs.push(`patterns missing ${skill}`);
    else if (n > 1) errs.push(`patterns duplicate ${skill}`);
  }
}

// --- loader -----------------------------------------------------------------

const topLevel = import.meta.glob<unknown>('/content/uk/*.json', { eager: true, import: 'default' });
const episodeFiles = import.meta.glob<Episode>('/content/uk/episodes/*.json', { eager: true, import: 'default' });

function fromFile<T>(name: string, fallback: T): T {
  return (topLevel[`/content/uk/${name}.json`] as T | undefined) ?? fallback;
}

export function loadContent(): Content {
  const episodes = Object.entries(episodeFiles)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, ep]) => ep);
  return {
    ui: fromFile<Record<string, string>>('ui', {}),
    levels: fromFile<Level[]>('levels', []),
    facts: fromFile<Fact[]>('facts', []),
    patterns: fromFile<Pattern[]>('patterns', []),
    episodes,
  };
}
