import type { Answer, Clip, Content, FeedEvent, Question, RunResult, Session, Skill, TrapKind } from './types';
import { levelFor } from './levels';

const SKILL_ORDER: Skill[] = ['detail', 'source', 'herd', 'motive'];
const PENALISED: TrapKind[] = ['fake', 'clickbait', 'ad', 'rage'];
const TRAP_SKILL: Partial<Record<TrapKind, Skill>> = { fake: 'source', clickbait: 'detail', ad: 'motive', rage: 'motive' };
const POINTS = 10;
const LUCKY = 5;
const MAX_LINES = 4;

/** Ukrainian plural of «раз» for n. */
export function pluralRaz(n: number): string {
  const m100 = n % 100;
  const m10 = n % 10;
  if (m100 >= 11 && m100 <= 14) return 'разів';
  if (m10 === 1) return 'раз';
  if (m10 >= 2 && m10 <= 4) return 'рази';
  return 'разів';
}

const allQuestions = (s: Session): Question[] => s.rounds.flatMap((r) => r.questions);
const allClips = (s: Session): Map<string, Clip> => {
  const m = new Map<string, Clip>();
  for (const r of s.rounds) if (r.kind === 'feed') for (const c of r.clipSet.clips) m.set(c.id, c);
  return m;
};

interface Graded { wrong: Question[]; lucky: Question[]; lost: number; confidentWrong: number; moreTime: boolean }

function grade(session: Session, answers: Answer[]): Graded {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const g: Graded = { wrong: [], lucky: [], lost: 0, confidentWrong: 0, moreTime: false };
  for (const q of allQuestions(session)) {
    const a = byId.get(q.id);
    if (!a) continue;
    if (a.moreTime) g.moreTime = true;
    if (a.chosen !== q.correct) {
      g.wrong.push(q);
      g.lost += POINTS;
      if (a.confidence === 'sure') g.confidentWrong++;
    } else if (q.why && a.whyChosen !== q.why.correct) {
      g.lucky.push(q);
      g.lost += POINTS - LUCKY;
    }
  }
  return g;
}

/** Penalised clips (once per clip): the worst penalty wins (share 5 > like 3). */
function penalties(session: Session, events: FeedEvent[]) {
  const clips = allClips(session);
  const per = new Map<string, { trap: TrapKind; points: number; shared: boolean }>();
  for (const e of events) {
    if (e.kind === 'dwell') continue;
    const trap = clips.get(e.clipId)?.trap;
    if (!trap || !PENALISED.includes(trap)) continue;
    const points = e.kind === 'share' ? 5 : 3;
    const prev = per.get(e.clipId);
    per.set(e.clipId, {
      trap,
      points: Math.max(prev?.points ?? 0, points),
      shared: (prev?.shared ?? false) || e.kind === 'share',
    });
  }
  return [...per.values()];
}

export function scoreRun(session: Session, answers: Answer[], feedEvents: FeedEvent[], content: Content, now: Date = new Date()): RunResult {
  const questionCount = allQuestions(session).length;
  const g = grade(session, answers);
  const pens = penalties(session, feedEvents);
  const penaltyTotal = pens.reduce((s, p) => s + p.points, 0);
  const points = POINTS * questionCount - g.lost;
  const raw = Math.round(((points - penaltyTotal) / (POINTS * questionCount || 1)) * 100);
  const percent = Math.min(100, Math.max(0, raw));

  const misses = new Map<Skill, number>();
  const miss = (s: Skill) => misses.set(s, (misses.get(s) ?? 0) + 1);
  [...g.wrong, ...g.lucky].forEach((q) => miss(q.skill));
  pens.forEach((p) => miss(TRAP_SKILL[p.trap]!));
  let pattern: Skill | null = null;
  let best = 1;
  for (const s of SKILL_ORDER) {
    const n = misses.get(s) ?? 0;
    if (n > best) { best = n; pattern = s; }
  }

  const clips = allClips(session);
  const sharedTrap = (t: TrapKind) => feedEvents.some((e) => e.kind === 'share' && clips.get(e.clipId)?.trap === t);
  const lines: string[] = [];
  if (g.confidentWrong >= 1) lines.push(`Ти був певен — і помилився ${g.confidentWrong} ${pluralRaz(g.confidentWrong)}.`);
  g.wrong.forEach((q) => lines.push(q.verdictLine));
  if (g.lucky.length) lines.push('Ти вгадав, але не знав чому.');
  if (sharedTrap('fake')) lines.push('Ти переслав фейк.');
  if (sharedTrap('rage')) lines.push('Тебе розлютили — і ти поширив.');
  if (feedEvents.some((e) => e.kind === 'like' && clips.get(e.clipId)?.trap === 'clickbait')) lines.push('Ти лайкнув клікбейт.');
  if (feedEvents.some((e) => e.kind === 'dwell' && e.ms >= 3000 && ['clickbait', 'ad'].includes(clips.get(e.clipId)?.trap ?? ''))) {
    lines.push('Ти завис на клікбейті.');
  }
  if (g.moreTime) lines.push('Тобі знадобилось більше часу на читання.');

  return {
    percent,
    level: levelFor(percent, content.levels).id,
    verdictLines: [...new Set(lines)].slice(0, MAX_LINES),
    pattern,
    confidentWrong: g.confidentWrong,
    at: now.toISOString(),
  };
}

/** 0–100, rises with mistakes so far. */
export function sheepMeter(session: Session, answers: Answer[], feedEvents: FeedEvent[]): number {
  const g = grade(session, answers);
  const pen = penalties(session, feedEvents).reduce((s, p) => s + p.points, 0);
  const answered = answers.length;
  const v = Math.round((100 * (g.lost + pen)) / (POINTS * answered || 1));
  return Math.min(100, Math.max(0, v));
}
