export type LevelId = 'sheep' | 'molly' | 'boxer' | 'benjamin' | 'orwell';
export type Round3Type = 'fake-or-true' | 'answer-in-front' | 'headline-vs-text'
  | 'herd' | 'motive' | 'close-reading' | 'farm' | 'enemy' | 'newspeak' | 'rewritten';
export type QuestionType = 'recall' | Round3Type;
export type TrapKind = 'fake' | 'clickbait' | 'ad' | 'rage' | 'real';
export type Skill = 'detail' | 'source' | 'herd' | 'motive';   // fixed order = tie-break order
export type Confidence = 'guess' | 'maybe' | 'sure';           // «Навмання» | «Мабуть» | «Точно»

export interface Source { label: string; url: string }
export interface License { source: string; url: string; license: string } // license 'placeholder' allowed only pre-release

export interface Clip {
  id: string; webm: string; mp4: string; poster: string;
  handle: string; caption: string; likes: string; comments: string; shares: string;
  overlay?: string;            // on-clip text (fake headline, small print…)
  trap?: TrapKind;
  license: License;
}
export interface ClipSet { id: string; round: 1 | 2; clips: Clip[]; questionIds: string[];
  rewrite?: { clipId: string; questionId: string } }  // round 1 only: the clip whose post comes back changed in round 3

export type Material =
  | { kind: 'telegram'; channel: string; text: string; views: string; time: string }
  | { kind: 'schedule'; queue: string; slots: { from: string; to: string; on: boolean }[]; chat: string[]; now: string }
  | { kind: 'article'; headline: string; body: string }
  | { kind: 'text'; body: string; vanishSeconds: number }
  | { kind: 'rewritten'; channel: string; before: string; after: string };  // shows `after`; `before` revealed after the answer

export interface Option { id: 'a' | 'b' | 'c' | 'd'; text: string }
export interface Question {
  id: string; type: QuestionType; prompt: string; material?: Material;
  options: Option[]; correct: Option['id'];
  skill: Skill;               // what a miss on this question says about you
  why?: { options: Option[]; correct: Option['id'] };  // «А чому?»; required for round-3 types, absent for 'recall'
  explanation: string;        // shown after answer
  verdictLine: string;        // shown in verdict if wrong, e.g. «Ти пішов за натовпом.»
  herd?: { option: Option['id']; percent: number };  // fake crowd hint (type 'herd')
  source?: Source;            // required for 'enemy' and for 'fake-or-true' when the true answer is "правда"
  fakeLabel?: boolean;        // 'enemy': show «ФЕЙК» after answer
}
export interface Episode { id: string; date: string; clipSets: ClipSet[]; questions: Question[] }

export interface ExitPlan { read: { title: string; author: string; url?: string }[]; watch: Source[]; write: string; doIt: string; grow: Source[] }
export interface Level { id: LevelId; name: string; emoji: string; min: number; max: number;
  description: string; slogan: string; challengeLine: string; exitPlan: ExitPlan; quote?: string }
export interface Fact { id: string; text: string; source: Source; note?: string }
export interface Pattern { skill: Skill; line: string }  // «Твій шаблон: {line}»
/** Invented yellow-press pieces for the question-screen backdrop; `*word*` marks the red accent. */
export type PressItem =
  | { kind: 'paper'; masthead: string; headline: string; body?: string }
  | { kind: 'channel'; channel: string; text: string; views: string; time: string };
export interface Content { ui: Record<string, string>; levels: Level[]; facts: Fact[]; patterns: Pattern[];
  press: PressItem[]; episodes: Episode[] }

// runtime
export type FeedEvent =
  | { kind: 'like' | 'share'; clipId: string }
  /** `auto`: the feed moved on by itself, so the time on the clip says nothing about the user. */
  | { kind: 'dwell'; clipId: string; ms: number; auto?: boolean };
export interface Answer { questionId: string; chosen: Option['id']; confidence: Confidence; whyChosen?: Option['id']; moreTime?: boolean }
export interface SessionRound { kind: 'feed'; clipSet: ClipSet; questions: Question[] }
export interface RealityRound { kind: 'reality'; questions: Question[] }
export interface Session { seed: number; rounds: Array<SessionRound | RealityRound> }
export interface RunResult { percent: number; level: LevelId; verdictLines: string[];
  pattern: Skill | null; confidentWrong: number; at: string /* ISO */ }
