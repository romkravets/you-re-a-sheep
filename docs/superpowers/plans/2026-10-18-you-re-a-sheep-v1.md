# You're a sheep: v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v1 of «You're a sheep». It is a mobile-first static web experience in Ukrainian with five stages:
1. A fake short-video feed that traps the user.
2. A shattering transition.
3. A "reality" stage with critical-thinking questions.
4. An Animal-Farm-themed verdict.
5. A way out: exit plan, retest, sharing.

It also ships teacher, about and privacy pages.

**Architecture:**
- **Framework and pages.** Vite multi-page app built with Svelte 5 and TypeScript, no server.
- **Pure logic.** All logic lives in pure TS modules under `src/lib/`, unit-tested with Vitest: content validation, session building, scoring, levels, history, share links.
- **UI.** Svelte components under `src/` render a state machine (`src/app/Experience.svelte`).
- **Content.** Lives in JSON under `content/uk/`, grouped into dated episodes, and is validated by a schema test.
- **Generated files.** Build-time scripts generate per-level share-preview pages and the teacher PDF.

**Tech Stack:**
- Node 24, Vite 8, Svelte 5.57, `@sveltejs/vite-plugin-svelte` 7, TypeScript 5.
- GSAP 3.15 (Observer, SplitText), `d3-delaunay` 6.
- `@fontsource/literata` and `@fontsource/unbounded` 5.3.
- Vitest 5, `@playwright/test` 1.64, Lighthouse CI.
- `marked` 18 for page copy.
- GoatCounter for analytics.
- Vercel (Git integration) for hosting; GitHub Actions for tests, audit and Lighthouse.

**Spec:** `docs/superpowers/specs/2026-10-18-you-re-a-sheep-design.md`. Read it first. Section numbers (§) below refer to it.

## Global Constraints

- **Language and tone.** All user-facing copy is Ukrainian. Tone: bold, honest, slightly insulting, never humiliating for its own sake (§2). The «Ворог у стрічці» items are serious in tone, with no jokes about casualties or shelling (§3).
- **No AI-generated images**, anywhere (§8).
- **No personal data.** No accounts, no cookies, nothing sent except anonymous GoatCounter counters (§1, §7).
- **No server at runtime.** The output is a static `dist/`, deployed on Vercel (§10).
- **Security (§10a):** no inline scripts anywhere in the output; no third-party script origins; raw HTML in markdown never rendered; strict headers from `vercel.json`. Task 18 pins these.
- **First screen is the feed.** No intro, no rules, no "start" button. The project name appears only at the end (§3).
- **Run budget.**
  - Round 1: 8 clips and 3 questions.
  - Round 2: 6 clips and 2 questions.
  - Round 3: 5 questions. Three are mandatory: `farm`, `enemy`, and the `rewritten` question bound to the round-1 clip set. Two are random from the other round-3 types.
  - About 10 questions in total, about 4 min (§3).
  - Every question asks for confidence; every correct round-3 answer asks «А чому?» (§3 «Впевненість, «А чому?» і шаблон помилок»).
- **Content pool minimums** (§3):
  - 6 questions per round-3 type, except `rewritten` (one per round-1 clip set);
  - 3 clip sets per feed round.
- **Vanishing text** lasts at most 30 s, with a «мені потрібно більше часу» button that does not penalise but is noted in the verdict (§3).
- **Level thresholds** (% «думаю сам»): Вівця 0–29, Моллі 30–49, Боксер 50–69, Бенджамін 70–89, Орвелл 90–100 (§4).
- **Orwell quotes:** only short quotes, in our own translation from the English original. Never reproduce existing Ukrainian translations (§4).
- **Facts.** Every fact or number shown comes from `content/uk/facts.json` with a source URL. Never use the "goldfish 8 seconds" myth (§6).
- **Fakes.**
  - Fake "news" in feed traps and round-3 items are invented: no real names, media or brands.
  - `enemy` items are real, already-debunked fakes, each with a debunk URL. They get a «ФЕЙК» label after the answer.
  - "True" items are real verified facts with a source URL (§1, §3).
- **Accessibility.** Respect `prefers-reduced-motion` everywhere (§8). Full keyboard control on desktop: ↑/↓/Space/wheel for the feed, 1–3 and Enter for answers (§8).
- **Partner links** are labelled «партнерське посилання». None exist in v1 (§12).
- **Clips:** every clip has a license record. The release check fails while any clip is `placeholder` (§3, §11).
- **Disclaimer.** «Це не IQ-тест. Це дзеркало.» appears on the verdict and on the about page (§1).

## Review Focus

1. **`localStorage` throws or is empty** (private mode, blocked storage). The test still runs end to end, there is no retest prompt, and nothing crashes. Pinned in Task 5 (`history.test.ts › survives throwing storage`).
2. **Tampered or garbage share link** (`/c/xyz/?p=abc`, `?p=999`, `?p=-5`). The friend banner is hidden or clamped, and the test starts normally. Pinned in Task 6 (`share-link.test.ts › rejects garbage`).
3. **A clip fails to load or autoplay is blocked** (bad network, iOS Low Power Mode). The poster frame shows, the feed keeps advancing on its timer, and nothing hangs. Pinned in Task 8 (`feed.spec.ts › video failure falls back to poster`).
4. **Reload or the browser Back button mid-test.** Reload restarts cleanly from the feed with no stale half-state. Back on a question screen does not leave the site. Pinned in Task 11 (`flow.spec.ts › reload restarts cleanly`).
5. **`prefers-reduced-motion: reduce`.** The shatter becomes a crossfade, the character's breathing stops, and the vanishing text still gives the "more time" option. Pinned in Task 9 (`crack.spec.ts › reduced motion crossfades`).

---

## Pilot (Stage 0): build this first

Spec §13 «Етап 0». The pilot is the **first slice of v1**, built from the tasks below, not a throwaway prototype. When it is done, stop and hand it to the owner for a class test. The rest of v1 continues from the same code.

**Pilot run:** `feed1 → stop1 → feed2 → stop2 → reality (3 questions) → reveal → verdict` (round 2: 6 clips + 2 questions, plain cut back into the feed, the shatter only after the last «Стоп»; 14 clips x 4.5 s ≈ 63 s of feed).
- One round-1 clip set: 8 placeholder clips, with traps `fake`, `clickbait`, `ad`, `rage`, one `real`, and the `rewrite` post. 3 bound questions at `stop1`.
- Reality: the set's `rewritten` question, one `herd` and one `farm`, in that order.
- Verdict: `Reveal`, then level (emoji instead of engraving), percent, «Твій шаблон», verdict lines, «Це не IQ-тест. Це дзеркало.», «Пройти ще раз».

**Tasks, in order:**

| Task | Pilot scope |
|---|---|
| 1 Scaffold | Full. Only the `index.html` entry; the 3 page entries come with Task 16. |
| 2 Content | Full validator and tests. The `minimums` and `real content` checks stay for v1. |
| 3 Session | Full, plus `buildSession(content, seed, seen, { pilot: true })` returning `rounds: [round1, reality]`, where reality is the rewrite, one `herd` and one `farm`. Test: `pilot session shape`. `Session.rounds` becomes an array type (`Array<SessionRound \| RealityRound>`). |
| 4 Scoring | Full. |
| 8 Feed | Full. |
| 10 Questions | Full, materials limited to `Telegram`, `Chat` and `Rewritten`. |
| 11 Flow | Pilot stages only. No history, analytics or friend banner. Between `stop1` and `reality`, a 600 ms crossfade instead of `Crack`. |
| 12 Verdict | `Reveal` and the level spread only (items 1–2 of the content order) plus «Пройти ще раз». |
| 15 Content | Pilot content only: `ui.json`, `levels.json` (all 5, exit plans may be empty), `patterns.json`, and `episodes/pilot.json` with the set and questions above. |

**Added after the pilot build (2026-11-01):** a press backdrop behind question screens — `src/quiz/PressBackdrop.svelte` (`noise` behind «Стоп», `margins` on paper), content in `content/uk/press.json` (`PressItem`, `*word*` = red accent via `src/quiz/press.ts`), tests in `tests/unit/press.test.ts` and `tests/e2e/quiz.spec.ts`.

Skipped until after the class test: Tasks 5, 6, 7, 9, 13, 14, 16, 17, 18, and round 2.

**Done when:** `npm test` and `npx playwright test flow quiz feed` pass; `npm run dev -- --host` opens the pilot on a phone in the same Wi-Fi; a passive user (never touches anything except answers) reaches the verdict in under 4 minutes.

**Owner, before the class test:** replace the 8 placeholder clips with real ones (own or Pexels) using the same ids, and check the run on 2–3 phones.

## File Structure

```
index.html                         app entry (feed is first paint)
teacher/index.html                 teacher page entry
about/index.html                   about page entry
privacy/index.html                 privacy page entry
vite.config.ts                     multi-page config, preview-pages plugin
vercel.json                        build settings, clean URLs, security + cache headers
public/vendor/goatcounter-count.js vendored analytics script
public/c/redirect.js               preview-page redirect (external, CSP-safe)
public/teacher/lesson.pdf          generated by `npm run gen:pdf`, committed
playwright.config.ts               mobile (Pixel 7) + desktop projects
lighthouserc.json                  perf budget
scripts/gen-preview-pages.ts       writes dist/c/<levelId>/index.html with OG tags
scripts/gen-teacher-pdf.ts         prints teacher page to public/teacher/lesson.pdf
scripts/release-check.ts           fails on placeholder clips / missing credits
scripts/make-placeholder-clips.sh  ffmpeg: generates labelled placeholder clips
.github/workflows/ci.yml           test → audit → build → e2e → Lighthouse (no deploy)
.github/dependabot.yml             npm + github-actions, weekly
content/uk/ui.json                 interface strings
content/uk/levels.json             5 levels: copy, slogan, challenge line, exit plan
content/uk/facts.json              verified facts with sources
content/uk/patterns.json           one «Твій шаблон» line per skill
content/uk/pages/{teacher,about,privacy}.md
content/uk/episodes/2026-10-base.json   clip sets + question pool
content/credits.json               every clip/engraving/font: source, url, license
public/clips/*.{webm,mp4,jpg}      clips + posters
public/og/<levelId>.png            share-preview images (1200×630)
src/main.ts                        mounts Experience
src/pages/{teacher,about,privacy}.ts  mount Page.svelte with md
src/styles/tokens.css              design system tokens (neon, paper, poster)
src/styles/base.css
src/lib/types.ts                   content + runtime types
src/lib/content.ts                 loadContent(), validateContent()
src/lib/rng.ts                     mulberry32 seeded RNG, shuffle, pick
src/lib/session.ts                 buildSession()
src/lib/score.ts                   scoreRun(), sheepMeter()
src/lib/levels.ts                  levelFor()
src/lib/history.ts                 safe storage, results, seen ids, challenge
src/lib/share-link.ts              encode/decode friend links
src/lib/analytics.ts               track()
src/lib/storycard.ts               drawStoryCard(), shareOrDownload()
src/lib/motion.ts                  prefersReducedMotion(), gsap registration
src/app/Experience.svelte          stage state machine
src/app/SheepMeter.svelte
src/app/FriendBanner.svelte
src/feed/Feed.svelte  FeedClip.svelte  feed-input.ts  preload.ts
src/crack/Crack.svelte  shards.ts
src/quiz/QuestionScreen.svelte  Explanation.svelte
src/quiz/materials/{Telegram,Schedule,Article,Chat,VanishingText,Rewritten}.svelte
src/verdict/{Reveal,Verdict,ExitPlan,Challenge,Facts,ShareActions}.svelte
src/art/Character.svelte           renders engraving + breathing
src/art/engravings/<levelId>.svg|png
src/pages/Page.svelte              paper-styled markdown page
tests/unit/*.test.ts
tests/e2e/*.spec.ts
tests/fixtures/content.min.json    tiny valid content for unit tests
```

## Shared types (defined in Task 2, used everywhere)

```ts
// src/lib/types.ts
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
export interface Content { ui: Record<string, string>; levels: Level[]; facts: Fact[]; patterns: Pattern[]; episodes: Episode[] }

// runtime
export type FeedEvent = { kind: 'like' | 'share'; clipId: string } | { kind: 'dwell'; clipId: string; ms: number };
export interface Answer { questionId: string; chosen: Option['id']; confidence: Confidence; whyChosen?: Option['id']; moreTime?: boolean }
export interface SessionRound { kind: 'feed'; clipSet: ClipSet; questions: Question[] }
export interface RealityRound { kind: 'reality'; questions: Question[] }
export interface Session { seed: number; rounds: [SessionRound, SessionRound, RealityRound] }
export interface RunResult { percent: number; level: LevelId; verdictLines: string[];
  pattern: Skill | null; confidentWrong: number; at: string /* ISO */ }
```

---

### Task 1: Scaffold, design tokens, CI

**Files:**
- Create: `package.json`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `index.html`, `teacher/index.html`, `about/index.html`, `privacy/index.html`, `src/main.ts`, `src/styles/tokens.css`, `src/styles/base.css`, `playwright.config.ts`, `vercel.json`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `tests/e2e/smoke.spec.ts`, `tests/unit/smoke.test.ts`
- Modify: `.gitignore` (add `node_modules/`, `dist/`, `test-results/`, `playwright-report/`)

**Interfaces:**
- Produces:
  - npm scripts `dev`, `build`, `test` (vitest run), `e2e` (playwright), `check` (svelte-check), `release-check`;
  - CSS custom properties in `tokens.css`, listed in step 3.

- [ ] **Step 1:** Write `tests/e2e/smoke.spec.ts`. Load `/` and expect `document.documentElement.lang === 'uk'`. Load `/teacher/`, `/about/` and `/privacy/` and expect HTTP 200 for each. Write `tests/unit/smoke.test.ts` with `expect(1).toBe(1)`. This only proves the runner works.
- [ ] **Step 2:** Run `npx playwright test smoke` and expect it to FAIL, because there is no server yet.
- [ ] **Step 3:** Set up the project.
  - Install `svelte@5`, `vite@8`, `@sveltejs/vite-plugin-svelte@7`, `typescript`, `svelte-check`, `gsap@3.15`, `d3-delaunay@6`, `@fontsource/literata`, `@fontsource/unbounded`, `marked@18`, `vitest@5`, `@playwright/test@1.64`, `tsx`, `@lhci/cli`.
  - `vite.config.ts`:
    - `base: '/'`;
    - `build.rollupOptions.input` = the 4 HTML entries;
    - Vitest `include: ['tests/unit/**/*.test.ts']`.
  - `playwright.config.ts`:
    - `webServer` runs `npm run build && npx vite preview --port 4173`;
    - projects `mobile` (devices['Pixel 7']) and `desktop` (1440×900).
  - `tokens.css` defines:
    - neon: `--neon-pink #ff2d8a`, `--neon-violet #6b2bff`, `--neon-cyan #00e5ff`, `--feed-bg #000`, `--feed-ui #fff`;
    - paper: `--paper #f2ede3`, `--paper-deep #e9e1d1`, `--ink #161616`, `--ink-soft #4a443b`, `--rule rgba(22,22,22,.18)`;
    - poster: `--poster-red #c8241c`, `--poster-cream #efe4cf`, `--poster-black #1a1a1a`;
    - type: `--font-book 'Literata', Georgia, serif`, `--font-poster 'Unbounded', system-ui`, `--font-feed system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.

    Import Literata 400/700/400-italic and Unbounded 400/900 with the Cyrillic subsets only.
  - `base.css`:
    - `html{lang}` is set in the HTML;
    - `body{margin:0;background:var(--feed-bg)}`;
    - `@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}`.
  - Every HTML entry: `<html lang="uk">`, a viewport meta with `viewport-fit=cover`, and `<meta name="theme-color" content="#000">`.
  - `vercel.json`: `{"framework": "vite", "buildCommand": "npm run build", "outputDirectory": "dist", "cleanUrls": true, "trailingSlash": true}`. Headers are added in Task 18.
  - `ci.yml`:
    - on push and PR: `npm ci`, `npm test`, `npm audit --audit-level=high`, `npx playwright install --with-deps chromium`, `npm run e2e`;
    - `permissions: contents: read`;
    - every `uses:` pinned to a full commit SHA, with the version in a comment.

    Deployment is done by Vercel's Git integration, not by this workflow.
  - `dependabot.yml`: ecosystems `npm` and `github-actions`, interval weekly.
- [ ] **Step 4:** Run `npm test && npx playwright test smoke`. Expect PASS on both projects.
- [ ] **Step 5:** Commit: `chore: scaffold vite+svelte app, tokens, CI`.

### Task 2: Content types, validator, loader

**Files:**
- Create: `src/lib/types.ts` (exactly as in **Shared types**), `src/lib/content.ts`, `tests/fixtures/content.min.json`, `tests/unit/content.test.ts`

**Interfaces:**
- Produces:
  - `validateContent(c: Content, opts?: { release?: boolean; minimums?: boolean }): string[]`. Returns a list of human-readable errors; empty means valid.
  - `loadContent(): Content`. Imports `content/uk/*.json` (including `patterns.json`) and all `content/uk/episodes/*.json` via `import.meta.glob(..., { eager: true })`.

- [ ] **Step 1:** Write the tests in `content.test.ts`. The fixture is a minimal valid `Content` with 1 clip set per round, 1 question per type (each with `skill`, and `why` on round-3 types) and 4 patterns.
  - `fixture is valid`: `validateContent(fixture)` equals `[]`.
  - `correct must be an option`: change one question's `correct` to `'d'` when there are only 3 options. Errors contain `q:<id> correct "d" not in options`.
  - `enemy needs source and fakeLabel`: errors contain `q:<id> enemy requires source.url` and `q:<id> enemy requires fakeLabel`.
  - `clip set questionIds must exist`: an unknown id gives `clipset:<id> unknown question <qid>`. A question may be bound to at most one clip set (`q:<id> bound to multiple clip sets`).
  - `round 1 sets need 8 clips and ≥3 questions; round 2 sets need 6 clips and ≥2`.
  - `levels cover 0–100 contiguously`: change molly's `min` to 31 and expect `levels gap at 30`.
  - `vanishSeconds ≤ 30`.
  - `herd hint must point to a wrong option`.
  - `round-3 questions need why`: removing `why` from a non-`recall` question gives `q:<id> missing why`. A `why.correct` not among `why.options` gives `q:<id> why correct "<x>" not in options`. A `recall` question with `why` gives `q:<id> recall must not have why`.
  - `rewrite binding`: every round-1 clip set has `rewrite`; its `clipId` is in the set, its question has type `rewritten` and a `rewritten` material whose `before` equals that clip's `overlay`, and `before !== after`. Errors: `clipset:<id> missing rewrite`, `clipset:<id> rewrite clip <cid> not in set`, `q:<id> rewrite before does not match clip overlay`. A `rewritten` question not referenced by any clip set gives `q:<id> rewritten question unbound`. Round-2 sets must not have `rewrite`.
  - `patterns cover every skill once`: dropping the `motive` pattern gives `patterns missing motive`; a duplicate gives `patterns duplicate detail`.
  - `minimums` with `{ minimums: true }`: the fixture gives errors `type herd has 1 questions, need 6` and `round 1 has 1 clip sets, need 3`.
  - `release` with `{ release: true }`: a clip whose `license.license === 'placeholder'` gives `clip:<id> placeholder license`.
  - `real content passes minimums`: `validateContent(loadContent(), { minimums: true })` equals `[]`. Mark it `it.skip` until Task 15, which removes the skip.
- [ ] **Step 2:** Run `npx vitest run content` and expect FAIL (the module is missing).
- [ ] **Step 3:** Implement `validateContent` as plain checks, one per rule above, using the exact message formats. Implement `loadContent`, which merges the episodes.
- [ ] **Step 4:** Run `npx vitest run content` and expect PASS, with 1 skipped.
- [ ] **Step 5:** Commit: `feat: content schema and validator`.

### Task 3: Seeded RNG and session builder

**Files:**
- Create: `src/lib/rng.ts`, `src/lib/session.ts`, `tests/unit/session.test.ts`

**Interfaces:**
- Consumes: the types from Task 2.
- Produces:
  - `makeRng(seed: number): () => number`. mulberry32, returns [0,1).
  - `shuffle<T>(xs: readonly T[], rnd: () => number): T[]`
  - `buildSession(content: Content, seed: number, seenQuestionIds?: ReadonlySet<string>): Session`

- [ ] **Step 1:** Write the tests, using the Task 2 fixture extended in-test to 3 sets per round and 6 questions per type.
  - `deterministic`: the same seed gives a deep-equal session.
  - `round shapes`: round 0 has 8 clips and 3 questions. Round 1 has 6 clips and 2 questions. Round 2 has exactly 5 questions.
  - `feed questions belong to their set`: every round-0/1 question id is in `clipSet.questionIds`.
  - `round 3 always has farm, enemy and the rewrite`: over 200 seeds, each reality round has exactly one `farm`, exactly one `enemy`, the `rewritten` question of the chosen round-1 set (`rewrite.questionId`), and 2 others with 2 distinct types, none of them `farm`, `enemy`, `rewritten` or `recall`.
  - `bound questions never appear in round 3`: over 200 seeds, no reality-round question id is in any `clipSet.questionIds`.
  - `prefers unseen`: if `seenQuestionIds` contains all but one `farm` question, that unseen one is chosen. If all are seen, the builder falls back to any.
  - `options shuffled but correct preserved`: the option order differs across seeds, and `correct` still points to the same text.
- [ ] **Step 2:** Run `npx vitest run session` and expect FAIL.
- [ ] **Step 3:** Implement:
  1. Pick a clip set per round with `rnd`, preferring sets whose questions are unseen.
  2. Take that set's first N questions in shuffled order (N is 3 for round 1 and 2 for round 2).
  3. Round 3: pick one `farm` and one `enemy`, add the round-1 set's `rewrite.questionId`, then 2 other distinct round-3 types (not `rewritten`), one question each. Except for the rewrite, draw only from questions **not bound to any clip set** (bound questions belong to the feed). Prefer unseen. Shuffle the 5, but never put the rewrite first, so the feed has faded a little.
  4. Shuffle the option order per question.
- [ ] **Step 4:** Run `npx vitest run session` and expect PASS.
- [ ] **Step 5:** Commit: `feat: seeded session builder`.

### Task 4: Scoring and levels

**Files:**
- Create: `src/lib/score.ts`, `src/lib/levels.ts`, `tests/unit/score.test.ts`

**Interfaces:**
- Produces:
  - `scoreRun(session: Session, answers: Answer[], feedEvents: FeedEvent[], content: Content): RunResult`
  - `sheepMeter(session: Session, answers: Answer[], feedEvents: FeedEvent[]): number`. Returns 0–100; it rises with mistakes so far.
  - `levelFor(percent: number, levels: Level[]): Level`

**Scoring rules (decided here):**
- Each question is worth 10 points.
  - A wrong answer scores 0.
  - A correct answer without `why` scores 10.
  - A correct answer with `why` scores 10 if `whyChosen === why.correct`, else 5 (a **lucky guess**).
  - `confidence` never changes points.
- Penalties:
  - −5 for a `share` on a clip whose `trap` is `fake`, `clickbait`, `ad` or `rage`;
  - −3 for a `like` on such a clip;
  - each penalty counts once per clip.
- Formula: `percent = clamp(round((points - penalties) / (10 × questionCount) × 100), 0, 100)`.
- `confidentWrong` = the number of wrong answers with `confidence === 'sure'`.
- `pattern` (misses per skill):
  - +1 to `question.skill` for each wrong answer and each lucky guess;
  - +1 per penalised clip (once per clip, like the penalty), by trap kind: `fake` → `source`, `clickbait` → `detail`, `ad` and `rage` → `motive`;
  - `pattern` is the skill with the most misses if that count is ≥ 2, else `null`. Ties go to the earlier skill in `Skill` order (`detail`, `source`, `herd`, `motive`).
- `verdictLines`, in this order:
  1. «Ти був певен — і помилився {n} {раз|рази|разів}.» when `confidentWrong ≥ 1` (Ukrainian plural: 1, 21… → раз; 2–4, 22–24… → рази; else разів; 11–14 → разів);
  2. the `verdictLine` of each wrong answer;
  3. «Ти вгадав, але не знав чому.» if there is any lucky guess;
  4. «Ти переслав фейк.» for a share on a `fake` trap; «Тебе розлютили — і ти поширив.» for a share on a `rage` trap;
  5. «Ти лайкнув клікбейт.» for a like on `clickbait`;
  6. «Ти завис на клікбейті.» when dwell is ≥ 3000 ms on a `clickbait` or `ad` clip;
  7. «Тобі знадобилось більше часу на читання.» if any answer has `moreTime`.

  Deduplicate, max 4 lines. The pattern is not a verdict line; the verdict shows it separately (Task 12).
- `sheepMeter = round(100 × (lostPoints + penalties) / (10 × answeredSoFar || 1))`, clamped to 0–100. A lucky guess counts as 5 lost points.

- [ ] **Step 1:** Write the tests:
  - `all correct, no events → 100, orwell`;
  - `all wrong → 0, sheep`;
  - `share on fake costs 5 and adds line`: 10/10 correct and one fake share gives 95 and «Ти переслав фейк.»;
  - `penalty counted once per clip`: two shares on the same fake clip give 95;
  - `like on real trap costs nothing`;
  - `moreTime adds line but no penalty`;
  - `verdict lines capped at 4 and ordered as specified`;
  - `levelFor boundaries`: 29→sheep, 30→molly, 49→molly, 50→boxer, 69→boxer, 70→benjamin, 89→benjamin, 90→orwell, 100→orwell, and −3 clamps to sheep;
  - `sheepMeter starts at 0 and is 100 after one wrong answer`;
  - `lucky guess scores 5`: 9 fully correct and one correct answer with a wrong `whyChosen` gives 95 and «Ти вгадав, але не знав чому.»;
  - `confidence does not change points`: the same answers with all `guess` and all `sure` give the same `percent`;
  - `confident wrong counted and first`: 3 wrong answers with `sure` give `confidentWrong === 3` and line 1 «Ти був певен — і помилився 3 рази.»; plural forms for 1, 5, 11, 21 are «раз», «разів», «разів», «раз»;
  - `pattern needs 2 misses`: one `herd` miss gives `pattern === null`; two give `'herd'`;
  - `feed penalties count toward pattern`: one wrong `source` question plus one share on a `fake` clip gives `'source'`;
  - `pattern tie goes to earlier skill`: 2 `motive` misses and 2 `detail` misses give `'detail'`.
- [ ] **Step 2:** Run `npx vitest run score` and expect FAIL.
- [ ] **Step 3:** Implement as specified.
- [ ] **Step 4:** Run `npx vitest run score` and expect PASS.
- [ ] **Step 5:** Commit: `feat: scoring, verdict lines, levels`.

### Task 5: History, retest and 7-day challenge (safe storage)

**Files:**
- Create: `src/lib/history.ts`, `tests/unit/history.test.ts`

**Interfaces:**
- Produces:
  - `createHistory(storage?: Storage | null): History`. The default is `globalThis.localStorage`, wrapped in try/catch.
  - The `History` interface:

```ts
interface History {
  available: boolean;
  lastResult(): RunResult | null;
  saveResult(r: RunResult): void;          // keeps the last 10
  firstResult(): RunResult | null;         // for "Було X → стало Y"
  seenQuestionIds(): Set<string>;
  markSeen(ids: string[]): void;           // keeps the last 200
  retestDue(now: Date): boolean;           // last result ≥ 7 days old
  challenge(): { startedAt: string; days: boolean[] } | null;  // 7 booleans
  startChallenge(now: Date): void;
  toggleDay(i: number): void;
}
```

The storage key is `yas:v1`, holding a single JSON blob.

- [ ] **Step 1:** Write the tests using an in-memory `Storage` fake:
  - `save and read last/first result`;
  - `retestDue false at 6d23h, true at 7d`;
  - `seen ids capped at 200, newest kept`;
  - `challenge toggles persist`;
  - `survives throwing storage`: every Storage method throws. `available === false`, all reads return null or empty, writes do not throw;
  - `survives corrupt JSON`: the stored value `'{oops'` gives `lastResult() === null`;
  - `null storage`: `createHistory(null).available === false`.
- [ ] **Step 2:** Run `npx vitest run history` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run history` and expect PASS.
- [ ] **Step 5:** Commit: `feat: safe local history, retest, challenge`.

### Task 6: Friend links and share-preview pages

**Files:**
- Create: `src/lib/share-link.ts`, `scripts/gen-preview-pages.ts`, `tests/unit/share-link.test.ts`, `tests/unit/preview-pages.test.ts`
- Modify: `vite.config.ts` (a plugin that runs `genPreviewPages` in `closeBundle`)

**Interfaces:**
- Consumes: `LevelId`, `Level` and `content/uk/levels.json`.
- Produces:
  - `friendUrl(origin: string, base: string, r: { level: LevelId; percent: number }): string`. Returns `${origin}${base}c/${level}/?p=${percent}`.
  - `parseFriend(pathname: string, search: string, base: string): { level: LevelId; percent: number | null } | null`
  - `genPreviewPages(distDir: string, base: string, levels: Level[], siteUrl: string): void`. Writes `dist/c/<id>/index.html`.

- [ ] **Step 1:** Write the tests:
  - `round trip`: parsing the output of `friendUrl('https://x.ua','/','boxer',73)` gives `{ level:'boxer', percent:73 }`;
  - `works under base path /you-re-a-sheep/`;
  - `rejects garbage`:
    - unknown level `xyz` gives null;
    - `?p=abc` gives `percent:null`;
    - `?p=999` gives `percent:null`;
    - `?p=-5` gives `percent:null`;
    - `?p=73.5` gives 73;
    - no `/c/` segment gives null;
  - `preview page has OG tags`: running `genPreviewPages` on a temp dir, `c/boxer/index.html` contains `og:title` «У друга — Боксер. А ти?», `og:image` `${siteUrl}og/boxer.png`, `og:description` from `ui.json` key `og.description`, and `<script src="/c/redirect.js" data-level="boxer" defer></script>`. The external `redirect.js` does `location.replace('/?from=' + level + '&p=' + p)`, where `p` is the page's own `p` param, digits only. The page also has a `<noscript>` link to `/?from=boxer`. No inline script.
- [ ] **Step 2:** Run `npx vitest run share-link preview-pages` and expect FAIL.
- [ ] **Step 3:** Implement. The preview page is minimal static HTML. `siteUrl` comes from env `SITE_URL`, defaulting to `VERCEL_PROJECT_PRODUCTION_URL` (prefixed with `https://` and suffixed with `/`) when present, else `http://localhost:4173/`. The app reads `?from=&p=` on load through `parseFriend`-equivalent validation; add `parseFriendQuery(search)` to `share-link.ts` with the same rules and the same tests.
- [ ] **Step 4:** Run `npx vitest run share-link preview-pages` and expect PASS.
- [ ] **Step 5:** Commit: `feat: friend links and per-level preview pages`.

### Task 7: Analytics wrapper

**Files:**
- Create: `src/lib/analytics.ts`, `tests/unit/analytics.test.ts`
- Modify: `index.html`, `teacher/index.html`. Add the GoatCounter script tag only when `import.meta.env.VITE_GOATCOUNTER_CODE` is set, using Vite `transformIndexHtml` in `vite.config.ts`. The tag is `<script data-goatcounter="https://${CODE}.goatcounter.com/count" async src="/vendor/goatcounter-count.js"></script>`. The script is a **vendored** copy of GoatCounter's `count.js`, committed with its license recorded in `content/credits.json`. Never load it from `gc.zgo.at`.

**Interfaces:**
- Produces: `track(event: AnalyticsEvent, data?: Record<string, string | number>): void`, where

```ts
type AnalyticsEvent = 'start' | 'round1-stop' | 'reality' | 'verdict' | `level-${LevelId}`
  | 'share-card' | 'share-link' | 'retest' | 'retest-delta' | 'challenge-start' | 'from-teacher' | 'from-friend'
  | `pattern-${Skill | 'none'}`;
```

  It calls `window.goatcounter?.count({ path: 'event/' + name, title: JSON-free string, event: true })`. If the script is missing it is a no-op that never throws. `retest-delta` sends the path `event/retest-delta/<bucket>`, with buckets `-∞..-1`, `0`, `1-9`, `10-19`, `20+`.

- [ ] **Step 1:** Write the tests:
  - `no-op without goatcounter`;
  - `calls count with event path`;
  - `delta bucketing`: 0→`0`, 15→`10-19`, −4→`-∞..-1`, 33→`20+`;
  - `never throws if count throws`.
- [ ] **Step 2:** Run `npx vitest run analytics` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run analytics` and expect PASS.
- [ ] **Step 5:** Commit: `feat: anonymous analytics wrapper`.

### Task 8: The feed (clips, swipe, actions, fallback)

**Files:**
- Create: `src/feed/Feed.svelte`, `src/feed/FeedClip.svelte`, `src/feed/feed-input.ts`, `src/feed/preload.ts`, `src/lib/motion.ts`, `scripts/make-placeholder-clips.sh`, `tests/unit/feed-input.test.ts`, `tests/e2e/feed.spec.ts`, `tests/e2e/feed-harness.html` (a dev-only entry that mounts `Feed` with fixture clips; include it in the Vite inputs only when `mode === 'test'`, and make the Playwright `webServer` build with `--mode test`)

**Interfaces:**
- Consumes: `ClipSet`, `FeedEvent`.
- Produces:
  - `<Feed clipSet onevent={(e: FeedEvent) => void} ondone={() => void} />`. `ondone` fires when the user swipes past the last clip **or** when the auto-advance total runs out: the clips auto-advance after 4.5 s each, so a passive user still finishes.
  - `createFeedInput(el: HTMLElement, handlers: { next(): void; prev(): void }): () => void`. GSAP Observer: touch/pointer swipe with a 40 px threshold, wheel debounced to one step per gesture, keys ↑/↓/PageUp/PageDown/Space. Returns a cleanup function.
  - `preloadNext(clips: Clip[], index: number): void`. Sets `preload="auto"` on the next 2 videos only.
  - `prefersReducedMotion(): boolean` and `registerGsap()` in `motion.ts`.
  - `make-placeholder-clips.sh <id> <hex> "<label>"`. Uses ffmpeg to produce a 4 s 720×1280 WebM (VP9, CRF 40) and MP4 (H.264, CRF 30), both silent, plus a JPG poster, all ≤ 300 KB, in `public/clips/`. The clip is a colour gradient with slow zoom and a large label.

**UI requirements (§3, §8):**
- Each clip is full-height 9:16 with `<video playsinline muted loop autoplay poster>`.
- Overlays, in TikTok style:
  - right rail: like, comment, share with counts;
  - bottom: handle and caption;
  - the `overlay` text box;
  - the sound icon: the first tap unmutes.
- Like and share toggle visually and emit a `FeedEvent`. Dwell is measured per clip and emitted on leave.
- Desktop (≥ 900 px): a centred column with `height: 92vh; aspect-ratio: 9/16`. The background glow is a radial gradient that samples the clip's `--glow` colour; set it per clip from the poster's average colour, computed once into a CSS var on load via a 1×1 canvas.
- A small, discreet hint, «↑ ↓ / коліщатко», only on desktop and only for the first clip.
- If a video `error`s or `play()` rejects, keep the poster visible and continue the timer.

- [ ] **Step 1:** Write the unit tests for `feed-input`:
  - a synthetic pointer drag of −60 px calls `next`;
  - −20 px calls nothing;
  - ArrowDown calls `next`; ArrowUp calls `prev`;
  - 5 wheel events within 300 ms call `next` once;
  - cleanup removes the listeners.

  Write `feed.spec.ts` (mobile and desktop):
  - `swipe advances and emits like/share events`;
  - `passive user reaches done in ≤ 8×4.5 s + 2 s`: use `page.clock` to fast-forward;
  - `video failure falls back to poster`: route `**/*.webm` and `**/*.mp4` to abort. The poster `img` is visible, and the feed still reaches done;
  - `desktop shows centred column and keyboard works`.
- [ ] **Step 2:** Run `npx vitest run feed-input && npx playwright test feed` and expect FAIL.
- [ ] **Step 3:** Implement the components, then generate the fixture placeholder clips with the script (8 clips, ids `ph-1`…`ph-8`).
- [ ] **Step 4:** Run the same command and expect PASS.
- [ ] **Step 5:** Commit: `feat: tiktok-style feed with input, actions, fallback`.

### Task 9: Shatter transition

**Files:**
- Create: `src/crack/shards.ts`, `src/crack/Crack.svelte`, `tests/unit/shards.test.ts`, `tests/e2e/crack.spec.ts` (uses a `crack-harness.html` test entry, as in Task 8)

**Interfaces:**
- Produces:
  - `makeShards(w: number, h: number, impact: { x: number; y: number }, count: number, rnd: () => number): { points: [number, number][]; centroid: [number, number] }[]`. Builds a Voronoi diagram via `d3-delaunay` with seeds biased towards the impact point: 60% of the seeds within 25% of `min(w,h)` of it.
  - `<Crack source={HTMLElement} impact={{x,y}} ondone={() => void} variant="feed-to-paper" />`.
    1. Snapshot the current feed frame: draw the visible `<video>`/poster and overlay onto a canvas. Overlay text is drawn as text, which is good enough.
    2. Draw radial crack lines (120 ms).
    3. Then shards fly out with GSAP: random rotation, translate away from the impact point, ease `power3.in`, 900 ms total, revealing the paper layer underneath.
    4. With reduced motion: a 300 ms crossfade instead.
    5. A short haptic `navigator.vibrate?.(30)`.

**Count:** 28 shards on mobile, 44 on desktop. On desktop the column's shards fly across the whole viewport (§8).

- [ ] **Step 1:** Write the tests:
  - `shards cover the area`: the polygon areas sum to `w×h ± 1%`;
  - `count respected`;
  - `deterministic with seeded rnd`;
  - `bias`: at least 50% of the centroids lie within `0.35×min(w,h)` of the impact point.

  `crack.spec.ts`:
  - `ondone fires within 1.5 s`;
  - `reduced motion crossfades`: `page.emulateMedia({ reducedMotion: 'reduce' })`, no shard canvas appears, and done fires within 600 ms.
- [ ] **Step 2:** Run `npx vitest run shards && npx playwright test crack` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command and expect PASS.
- [ ] **Step 5:** Commit: `feat: glass shatter transition`.

### Task 10: Question screens, materials, sheep meter

**Files:**
- Create: `src/quiz/QuestionScreen.svelte`, `src/quiz/Explanation.svelte`, `src/quiz/materials/Telegram.svelte`, `Schedule.svelte`, `Article.svelte`, `Chat.svelte`, `VanishingText.svelte`, `src/app/SheepMeter.svelte`, `tests/e2e/quiz.spec.ts` (with a `quiz-harness.html` test entry)

**Interfaces:**
- Consumes: `Question`, `Material`, `Answer`.
- Produces:
  - `<QuestionScreen question theme={'feed-stop' | 'paper'} index total onanswer={(a: Answer) => void} />`. Steps, with no going back:
    1. material and options; the user picks;
    2. «Наскільки ти впевнений?» with three buttons «Навмання» / «Мабуть» / «Точно»;
    3. only if the answer is correct and the question has `why`: «Так. А чому?» with the `why` options;
    4. `<Explanation>` and a «Далі →» button; `onanswer` fires on «Далі».
  - `<SheepMeter value={0..100} theme />`.

**UI requirements:**
- `feed-stop` theme: black screen, white text, a red «🛑 Стоп.» kicker. It is used for the round 1/2 questions.
- `paper` theme: book typography. On ≥ 900 px it is a two-page spread, with the material and an engraving vignette on the left and the prompt and options on the right. On mobile they stack.
- Keys: 1–4 choose an option, 1–3 choose confidence and the «чому» option, Enter confirms «Далі».
- Confidence and «чому» steps must not reveal correctness before the user commits: the chosen option stays highlighted neutrally until confidence is picked.
- Explanation after a lucky guess: «✅ Так, але причина інша», then the correct `why` option and `explanation`.
- `herd`: show `👥 {percent}%` beside the fake option. After the answer, the explanation must reveal «Цієї цифри не було — це пастка.» (append it automatically).
- `enemy`: after the answer, a red «ФЕЙК» stamp over the material and a «Спростування: {source.label}» link (`target=_blank rel=noopener`).
- `rewritten`: the material looks like the feed post (same handle, same caption style) but on paper. After the answer, show «Було» (`before`) and «Стало» (`after`) side by side with the changed words highlighted (word-level diff).
- `VanishingText`: the text fades out after `vanishSeconds`. Visible countdown. The «мені потрібно більше часу» button pauses the countdown and adds +30 s once; it sets `moreTime: true` in the answer. The question appears after the text vanishes or when the user taps «Я прочитав».
- Explanation, wrong: «❌ Неправильно», shows the chosen and the correct option, then `explanation`.
- Explanation, right: «✅ Так» plus `explanation`.
- `SheepMeter`: a thin bar labelled «рівень вівці», with a GSAP tween on change. It is fixed at the top on mobile and top-left on desktop.

- [ ] **Step 1:** Write `quiz.spec.ts`:
  - `wrong answer shows correct option and explanation`;
  - `keyboard 2, confidence 3, then Enter answers b with confidence sure`;
  - `confidence is asked before the explanation`: after picking an option, no «✅» or «❌» is visible until a confidence button is pressed;
  - `why only after a correct answer with why`: a correct round-3 answer shows «А чому?»; a wrong one and a `recall` question skip it;
  - `wrong why shows lucky-guess explanation` and `onanswer` receives `whyChosen`;
  - `herd reveal line appended`;
  - `rewritten shows before and after with the diff highlighted`;
  - `enemy shows ФЕЙК and source link`;
  - `vanishing text hides after N s and more-time sets moreTime` (using `page.clock`);
  - `desktop paper theme renders two columns` (check `getComputedStyle(grid).gridTemplateColumns` has 2 tracks).
- [ ] **Step 2:** Run `npx playwright test quiz` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx playwright test quiz` and expect PASS.
- [ ] **Step 5:** Commit: `feat: question screens and materials`.

### Task 11: Experience state machine

**Files:**
- Create: `src/app/Experience.svelte`, `src/app/FriendBanner.svelte`, `tests/e2e/flow.spec.ts`
- Modify: `src/main.ts` (mount `Experience` with `loadContent()`)

**Interfaces:**
- Consumes: everything from Tasks 2–10.
- Produces: the stages `feed1 → stop1 → feed2 → stop2 → crack → reality → reveal → verdict`.

**Behaviour:**
- On load:
  - `seed = crypto.getRandomValues` (32-bit);
  - `buildSession(content, seed, history.seenQuestionIds())`;
  - `track('start')`.

  If `parseFriendQuery(location.search)` is valid, `FriendBanner` shows «У друга {percent}% ({name}). А в тебе?» for 3 s as a toast over the feed, and `track('from-friend')`. If `?src=teacher` is present, `track('from-teacher')`.
- `stop1`/`stop2`:
  1. A quick crack flash: Crack with the `stop` variant, 8 shards, 400 ms.
  2. Then that round's questions in the `feed-stop` theme.
  3. Then back to the feed for round 2.
- After `stop2`: the full `Crack`, then `reality`, which runs the 5 questions in the `paper` theme.
- The sheep meter is visible in every stage except `crack`, `reveal` and `verdict`.
- On entering `reveal`:
  - `scoreRun`;
  - `history.markSeen(all question ids)`;
  - `history.saveResult`;
  - `track('verdict')`, `track('level-'+id)`, `track('pattern-'+(pattern ?? 'none'))`;
  - if this was a retest, `track('retest-delta', …)`.
- History: push a `history.pushState` entry per stage. On `popstate` during the test, re-push and stay; never exit mid-test.
- No session state is persisted: a reload starts a new session from `feed1`.

- [ ] **Step 1:** Write `flow.spec.ts` (mobile and desktop). Use `page.clock`, and seed via `?seed=123`, honoured only when `import.meta.env.MODE === 'test'`.
  - `first paint is the feed`: within 1.5 s a `video` or poster is visible, and there is no text «You're a sheep» or «почати».
  - `full run reaches verdict with a level`: always pick option a, confidence «Мабуть» and «чому» option a. A verdict with one of the 5 level names is visible, and `localStorage['yas:v1']` contains `lastResult`.
  - `reload restarts cleanly`: after reaching `reality`, reload. The feed shows and the sheep meter equals 0.
  - `back button does not leave mid-test`: on `stop1`, `page.goBack()` keeps the URL origin and the stage element visible.
  - `friend banner shows from valid link and not from garbage`: `?from=boxer&p=73` shows «73%» and «Боксер». `?from=xyz&p=abc` shows no banner.
- [ ] **Step 2:** Run `npx playwright test flow` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx playwright test flow` and expect PASS.
- [ ] **Step 5:** Commit: `feat: experience flow`.

### Task 12: Reveal and verdict

**Files:**
- Create: `src/verdict/Reveal.svelte`, `Verdict.svelte`, `ExitPlan.svelte`, `Challenge.svelte`, `Facts.svelte`, `ShareActions.svelte`, `tests/e2e/verdict.spec.ts`
- Modify: `src/app/Experience.svelte` (render these)

**Interfaces:**
- Consumes: `RunResult`, `Level`, `Fact[]`, `History`, `Character` (Task 14; until then a placeholder `<div>` with the level emoji).
- Produces: `<Verdict result level facts patterns history onretry />`.

**Content order (§3 «Фінал»):**
1. `Reveal`, a full-screen paper page. Typed in with SplitText, lines staggered: «Ферма існує.» / «Свині — це алгоритми і ті, хто ними користується.» / «Ти щойно побачив, як вони працюють.» Tap or 4 s to continue. The project title «You're a sheep» appears here for the first time, as the last line.
2. Level spread:
   - Character on the left (desktop) or top (mobile);
   - «Рівень N з 5», the name, the percent, the description;
   - if `result.pattern` is set: «Твій шаблон:» and that skill's `Pattern.line`, set apart from the list (bold, larger);
   - the verdict lines as a list;
   - «Це не IQ-тест. Це дзеркало.»
3. If there was a previous result (`history.firstResult()` exists and differs from this run): «Було {p1}% ({name1}) → стало {p2}% ({name2})», and «Впевнених помилок: було {c1} → стало {c2}» when either count is > 0.
4. `ExitPlan` with headings «Читати», «Дивитися», «Писати», «Робити», «Розвиватися».
5. `Challenge`:
   - if none is active: the button «Прийняти виклик: 7 днів. Стань книгою», with one line: «Обери книжку з плану, читай по 20 хвилин замість стрічки, на 7-й день перекажи її другові»;
   - if active: 7 day toggles plus «Через 7 днів пройди тест знову»;
   - when `retestDue`: the banner «Минуло 7 днів — перевір, чи ти змінився» with a retest button that calls `onretry` and `track('retest')`.
6. `Facts`: 3 facts chosen at random, each with its source link.
7. `ShareActions`:
   - «Кинути виклик» (story card, Task 13);
   - «Кинь другу» (copies `friendUrl` and uses `navigator.share` when available, then `track('share-link')`);
   - «Пройти ще раз»;
   - links «Для вчителя» `${base}teacher/`, «Хто ми» `${base}about/`, «Приватність» `${base}privacy/`.

- [ ] **Step 1:** Write `verdict.spec.ts`. Mount via a `verdict-harness.html` test entry with fixture results.
  - `shows level, verdict lines, disclaimer`;
  - `shows pattern when set and hides it when null`;
  - `retest delta shown when previous result exists`, including the confident-mistakes line;
  - `challenge toggles persist across reload`;
  - `retest banner appears when last result is 7 days old`: seed `localStorage` with a result dated 8 days ago;
  - `share link copied`: stub `navigator.clipboard`; the copied value matches `/c/boxer/?p=`;
  - `facts each have a link`.
- [ ] **Step 2:** Run `npx playwright test verdict` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx playwright test verdict` and expect PASS.
- [ ] **Step 5:** Commit: `feat: reveal and verdict`.

### Task 13: Story challenge card

**Files:**
- Create: `src/lib/storycard.ts`, `tests/unit/storycard.test.ts`, `tests/e2e/storycard.spec.ts`
- Modify: `src/verdict/ShareActions.svelte`

**Interfaces:**
- Produces:
  - `drawStoryCard(ctx: CanvasRenderingContext2D, d: { level: Level; percent: number; siteLabel: string; characterImg: CanvasImageSource }): void`. Draws at 1080×1920.
  - `cardText(level: Level, percent: number): { kicker: string; headline: string; dare: string; slogan: string }`. Pure function.
  - `shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'>`

**Copy (exact):**
- `kicker` = `Я — ${level.name}. ${percent}%`
- `headline` = `level.challengeLine`, defined in `levels.json`. It dares the friend, for example «А ти, мабуть, вівця.»
- `dare` = «Доведи, що ні →»
- `slogan` = `level.slogan`

**Look (§8, poster):**
- cream background, with red/cream conic rays from the top-left;
- the character image in black;
- the headline on a black band rotated −3° in Unbounded 900, uppercase;
- the slogan on a red band;
- `siteLabel` at the bottom;
- fonts awaited via `document.fonts.load` before drawing.

- [ ] **Step 1:** Write the tests.
  - `cardText for boxer 73`: the kicker is «Я — Боксер. 73%», and the dare is «Доведи, що ні →».
  - `shareOrDownload uses navigator.share with files when canShare`. Then: `falls back to <a download> when share missing or rejects with non-AbortError`. Then: `AbortError (user cancelled) resolves 'shared' without download`.
  - In `storycard.spec.ts`, `canvas renders 1080×1920 non-blank` checks that the pixel at (540, 200) differs from the pixel at (540, 1900).
- [ ] **Step 2:** Run `npx vitest run storycard && npx playwright test storycard` and expect FAIL.
- [ ] **Step 3:** Implement, then wire «Кинути виклик»:
  1. render to an offscreen canvas;
  2. `toBlob('image/png')`;
  3. call `shareOrDownload(blob, 'you-re-a-sheep-'+level.id+'.png')`;
  4. `track('share-card')`.
- [ ] **Step 4:** Run the same command and expect PASS.
- [ ] **Step 5:** Commit: `feat: story challenge card`.

### Task 14: Characters and engravings

**Files:**
- Create: `src/art/Character.svelte`, `src/art/engravings/{sheep,molly,boxer,benjamin,orwell}.(svg|png)`, `src/art/vignettes/*.png` (2–4 small engravings for the paper pages), `public/og/<levelId>.png` (1200×630), `content/credits.json` entries, `tests/unit/credits.test.ts`
- Modify: `src/verdict/Verdict.svelte`, `src/lib/storycard.ts` caller, `src/quiz/QuestionScreen.svelte` (vignette)

**Interfaces:**
- Produces: `<Character id={LevelId} size breathe={true} />`, and `credits.json` entries of the form `{ file, title, author, source, url, license }`.

**Requirements:**
- Use only 19th-century or earlier engravings in the public domain, from Wikimedia Commons, the Biodiversity Heritage Library or Old Book Illustrations:
  - sheep, horse (for Molly: a mare, ideally with ribbons or an elegant pose), heavy draught horse (Boxer), donkey (Benjamin);
  - for Orwell: a quill, an inkwell or an open book, **not** a photo or portrait of Orwell.
- Clean to ink-on-transparent, using an ffmpeg threshold or colorkey filter. Keep files under 120 KB each.
- Record each file in `credits.json` with its license URL. Any file whose license is not PD or CC0 is rejected.
- `breathe`: a GSAP `scaleY 1→1.015`, yoyo, 3.2 s, `sine.inOut`, `transform-origin: bottom`. It is disabled under reduced motion.
- OG images: the poster style of Task 13 at 1200×630, rendered by a Playwright script `scripts/gen-og.ts` that runs `drawStoryCard`-like drawing and saves the PNGs. Add an npm script `gen:og`.

- [ ] **Step 1:** Write `credits.test.ts`:
  - every file under `src/art/` and `public/og/` and every non-placeholder clip in content has a `credits.json` entry;
  - every license is in the allowlist `['PD', 'CC0', 'Pexels', 'own', 'OFL']`;
  - every url starts with `https://`.
- [ ] **Step 2:** Run `npx vitest run credits` and expect FAIL.
- [ ] **Step 3:** Source, process and credit the assets. Build `Character`, run `npm run gen:og`, and replace the emoji placeholders.
- [ ] **Step 4:** Run `npx vitest run credits && npx playwright test verdict storycard` and expect PASS.
- [ ] **Step 5:** Commit: `feat: engraved characters, vignettes, OG images`.

### Task 15: Real content (copy, levels, facts, pools)

**Files:**
- Create or fill: `content/uk/ui.json`, `content/uk/levels.json`, `content/uk/facts.json`, `content/uk/episodes/2026-10-base.json`, `public/clips/*` (placeholders via the Task 8 script)
- Modify: `tests/unit/content.test.ts` (remove `.skip` from `real content passes minimums`)

**Requirements:**
- `levels.json`:
  - 5 levels with the names, ranges and meanings exactly as in the §4 table;
  - `slogan` per level, in the farm-slogan style («Чотири свайпи — добре! Думати — погано!» for sheep);
  - `challengeLine` per level;
  - `quote` as our own translation of a short line from the English original.
- `exitPlan` per level:
  - «Скотний двір» / «Колгосп тварин» first for everyone;
  - the other books, channels and media-literacy resources come from the §5 candidates.

  Before adding each item, **verify with a web search** that the book exists in Ukrainian and the resource URL is live. Drop anything unverified.
- `facts.json`: exactly the §6 list, with URLs. Use the note «Головні причини — війна й ковід» on the PISA fact.
- `patterns.json`: one `line` per skill, in the §2 tone, naming a habit, not insulting the person. Starting drafts:
  - `detail`: «ти бачиш картинку, а не деталі. Дрібний шрифт і цифри проходять повз тебе — а правду ховають саме там.»;
  - `source`: «ти віриш повідомленню, не питаючи, хто його написав.»;
  - `herd`: «коли не впевнений, ти йдеш за більшістю.»;
  - `motive`: «ти не питаєш, хто на цьому заробляє.»
- `newspeak` (≥ 6): what a nice word really means. Mix ads and corporations («оптимізація штату», shrinkflation) with documented propaganda euphemisms; the propaganda ones need a `source`, like `enemy`.
- `rewritten`: one per round-1 clip set, bound via `rewrite`. The changed post is an ordinary one (no trap), with a concrete number, date or promise; the change is small but meaningful (a number, «лише», a date). One option is always «Нічого не змінилось».
- Each round-1 clip set has one `rage` trap: an invented clip built to make you angry, with «поширте, хай усі знають!». No real people, groups or events.
- Every question has a `skill`. Default by type: `close-reading`, `headline-vs-text`, `answer-in-front`, `rewritten`, `newspeak` → `detail`; `fake-or-true`, `enemy` → `source`; `herd` → `herd`; `motive`, `farm` → `motive`; `recall` → whatever the question actually tests (counting cats → `detail`, «що не так з новиною» → `source`).
- Every round-3 question has `why` with 2–3 options: one real reason and plausible wrong reasons (for example for a fake: «бо немає джерела» vs «бо там багато знаків оклику»). The wrong reasons must be ones a person might actually think, not jokes.
- Questions, written in the §2 tone:
  - ≥ 6 per round-3 type;
  - 3 round-1 clip sets: 8 clips each, at least 3 traps (`fake`, `clickbait`, `ad`), ≥ 3 bound questions each, including one pure-recall question («Скільки котів…» style);
  - 3 round-2 clip sets: 6 clips each, with subtler traps, one `real` trap that looks fake, ≥ 2 bound questions;
  - `answer-in-front` uses the `schedule` material (the outage-schedule scenario);
  - `close-reading` uses `text` with `vanishSeconds` ≤ 30;
  - `herd` puts the fake percent on a wrong option.
- `enemy` (≥ 6):
  - only fakes already debunked by StopFake, VoxCheck, the Center for Countering Disinformation or a comparable fact-checker;
  - each with a `source` linking to the debunk and `fakeLabel: true`;
  - serious tone;
  - render the fake's text paraphrased and shortened, so the card cannot be screenshotted as a standalone fake.

  Verify every link.
- Fake items are invented: no real people, media or brands.
- Clips: generate placeholders for all clip ids with labels describing the intended footage (for example «кіт стрибає на огірок»), with license `placeholder`. Real clips are the owner's job (§11).
- [ ] **Step 1:** Remove `.skip` from `real content passes minimums`. Run `npx vitest run content` and expect FAIL with the minimum-count errors.
- [ ] **Step 2:** Write the content and verify the sources.
- [ ] **Step 3:** Run `npx vitest run content` and expect PASS. Then run `npx playwright test flow`, which still passes with the real content.
- [ ] **Step 4:** Commit: `content: v1 Ukrainian content, levels, facts, pools`.

### Task 16: Teacher, about and privacy pages

**Files:**
- Create: `src/pages/Page.svelte`, `src/pages/teacher.ts`, `about.ts`, `privacy.ts`, `content/uk/pages/teacher.md`, `about.md`, `privacy.md`, `scripts/gen-teacher-pdf.ts`, `tests/e2e/pages.spec.ts`
- Modify: the 3 HTML entries; `package.json` (script `gen:pdf` runs `vite build && tsx scripts/gen-teacher-pdf.ts`. The PDF is written to `public/teacher/lesson.pdf` and committed, so the Vercel build never needs a browser)

**Requirements:**
- `Page.svelte` renders markdown via `marked` in the paper style, with raw HTML disabled: a `marked` renderer whose `html()` returns its input escaped, with a header that links back to the test (`${base}`).
- `teacher.md` (§9):
  - a 45-minute lesson plan as a timed outline: 5 min intro without spoilers, 10 min test, 20 min discussion with questions, 10 min on how to recognise ІПСО;
  - homework: the 7-day challenge and a retest;
  - a «Посилання для класу» button that copies `${origin}${base}?src=teacher`;
  - a download link to `lesson.pdf`.
- `teacher.md` discussion questions include the Bradbury point (§9), in our own words, no quotes.
- `about.md`: who and why, the Bradbury point (§9) in our own words, where the numbers come from (link to the facts), «Це не IQ-тест. Це дзеркало.», and a contact. The contact email is a placeholder `TODO-owner@example.com` that the release check flags.
- `privacy.md`: what is collected (anonymous GoatCounter counters, no cookies) and what is not (no names, contacts or answers sent; results stay in your browser), and how to clear it (the button «Видалити мої дані» clears `yas:v1`).
- `gen-teacher-pdf.ts`: runs `vite preview`, has Playwright Chromium print `/teacher/?print=1` to `public/teacher/lesson.pdf` (A4), then stops the server. Print CSS hides the buttons.
- [ ] **Step 1:** Write `pages.spec.ts`:
  - `teacher page has lesson outline and class link with src=teacher`;
  - `lesson.pdf exists and is > 10KB` (check `public/teacher/lesson.pdf` with `fs`);
  - `about has disclaimer`;
  - `privacy delete button clears storage`.
- [ ] **Step 2:** Run `npx playwright test pages` and expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx playwright test pages` and expect PASS.
- [ ] **Step 5:** Commit: `feat: teacher, about, privacy pages`.

### Task 17: Performance budget and release check

**Files:**
- Create: `lighthouserc.json` (`ci.collect.staticDistDir: "dist"`, `url: ["/"]`, `settings.preset` omitted to keep the mobile default), `scripts/release-check.ts`, `tests/unit/release-check.test.ts`
- Modify: `.github/workflows/ci.yml` (add a Lighthouse CI step after the build, with mobile emulation), `package.json`

**Requirements:**
- Lighthouse on `/`, mobile, simulated slow 4G:
  - performance ≥ 0.85, accessibility ≥ 0.9;
  - LCP ≤ 2500 ms;
  - total transfer before first interaction ≤ 600 KB (JS ≤ 120 KB gz, first clip ≤ 300 KB).

  GSAP and `d3-delaunay` must load **lazily**: dynamic `import()` when the feed's first clip starts (for Observer) and before the first crack.
- `release-check.ts` exits non-zero with a list when any of these hold:
  - a clip has a `placeholder` license;
  - an asset has no credit;
  - the about page still contains `TODO-owner`;
  - `validateContent(..., { release: true, minimums: true })` returns errors.

  CI runs it as a **non-blocking warning** step; the owner runs `npm run release-check` before announcing.
- [ ] **Step 1:** Write `release-check.test.ts`:
  - it reports the placeholder clips and `TODO-owner` in the current repo state;
  - it passes on a temp fixture without them.
- [ ] **Step 2:** Run `npx vitest run release-check` and expect FAIL.
- [ ] **Step 3:** Implement the release check, the lazy imports and the Lighthouse config.
- [ ] **Step 4:** Run `npm test && npm run build && npx lhci autorun` and expect the tests to pass and the Lighthouse assertions to pass. Run `npm run release-check` and expect a non-zero exit listing the placeholders (correct at this stage).
- [ ] **Step 5:** Commit: `chore: perf budget and release check`.

### Task 18: Security hardening

**Files:**
- Modify: `vercel.json` (`headers`)
- Create: `src/lib/security-headers.ts` (a single source for the CSP string and the header list, imported by `scripts/check-headers.ts`), `scripts/check-headers.ts`, `tests/unit/security.test.ts`, `tests/e2e/security.spec.ts`

**Interfaces:**
- Produces: `CSP: string` and `SECURITY_HEADERS: { key: string; value: string }[]`, exported from `security-headers.ts`. `vercel.json` must contain exactly these; a test enforces it.

**Exact policy:**
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.goatcounter.com; media-src 'self' blob:;
font-src 'self'; connect-src 'self' https://*.goatcounter.com;
frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none';
upgrade-insecure-requests
```
(`style-src 'unsafe-inline'` is required because Svelte and GSAP set inline style attributes. Scripts stay strict.)

**Other headers on `/(.*)`:**
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Opener-Policy: same-origin`

**Cache:** `/assets/(.*)` gets `Cache-Control: public, max-age=31536000, immutable`.

- [ ] **Step 1:** Write the tests.
  - `security.test.ts`:
    - `vercel.json headers equal SECURITY_HEADERS`.
    - `CSP has no unsafe-inline or unsafe-eval in script-src`.
    - `built HTML has no inline scripts`. After `npm run build`, every `dist/**/*.html` has no `<script>` without `src`, apart from `type="application/ld+json"` (none expected), and no `on*=` attributes.
    - `no third-party script origins`. Every `<script src>` in `dist` is same-origin (starts with `/`).
    - `markdown raw HTML is escaped`. Rendering `'<img src=x onerror=alert(1)>'` through the Page renderer gives no `<img` element.
  - `security.spec.ts`: serve `dist` with these headers. Use a tiny `scripts/serve-with-headers.ts` built on `node:http` that reads `SECURITY_HEADERS`. Then:
    - `full run has zero CSP violations`: listen for `securitypolicyviolation` events and `console` errors containing «Content Security Policy» during the flow test path;
    - `site refuses to be framed`: a test page on another port iframes the app, and the frame does not load.
- [ ] **Step 2:** Run `npx vitest run security && npx playwright test security` and expect FAIL.
- [ ] **Step 3:** Implement. `scripts/check-headers.ts` (npm `check:headers`) is the deployed check: `curl -sI` against `$SITE_URL` that verifies each header. The owner runs it after the first Vercel deploy.
- [ ] **Step 4:** Run the same command and expect PASS. Also run `npm audit --audit-level=high` and expect exit 0.
- [ ] **Step 5:** Commit: `feat: security headers and CSP`.

---

## After all tasks

- Run the whole suite: `npm test && npm run check && npm run e2e`. Everything must be green.
- Whole-branch code review (superpowers:requesting-code-review).
- Hand the owner the list of what they still need to do (§11):
  - real clips;
  - connect the repo to Vercel and add the domain there;
  - account security from spec §10a «Що робить власник» (2FA on GitHub/Vercel/registrar, branch protection on `main`, registrar transfer lock);
  - `VITE_GOATCOUNTER_CODE`;
  - the contact email;
  - `npm run release-check` until clean;
  - push.
