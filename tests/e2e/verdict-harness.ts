import { mount } from 'svelte';
import '../../src/styles/tokens.css';
import '../../src/styles/base.css';
import Reveal from '../../src/verdict/Reveal.svelte';
import Verdict from '../../src/verdict/Verdict.svelte';
import { loadContent } from '../../src/lib/content';
import { levelFor } from '../../src/lib/levels';
import type { RunResult, Skill } from '../../src/lib/types';

const content = loadContent();
const q = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;
w.__continued = 0;
w.__retried = 0;
const target = document.getElementById('app')!;

if (q.get('view') === 'reveal') {
  mount(Reveal, { target, props: { ui: content.ui, oncontinue: () => ((w.__continued as number)++) } });
} else {
  const p = q.get('pattern');
  const result: RunResult = {
    percent: Number(q.get('percent') ?? 62),
    level: levelFor(Number(q.get('percent') ?? 62), content.levels).id,
    verdictLines: ['Ти пішов за натовпом.', 'Ти повірив заголовку, не читаючи тексту.'],
    pattern: p && p !== 'none' ? (p as Skill) : null,
    confidentWrong: 1,
    at: '2026-10-31T10:00:00.000Z',
  };
  const level = levelFor(result.percent, content.levels);
  mount(Verdict, {
    target,
    props: { result, level, patterns: content.patterns, ui: content.ui, onretry: () => ((w.__retried as number)++) },
  });
}
