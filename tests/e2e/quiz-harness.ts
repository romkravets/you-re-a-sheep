import { mount } from 'svelte';
import '../../src/styles/tokens.css';
import '../../src/styles/base.css';
import QuestionScreen from '../../src/quiz/QuestionScreen.svelte';
import SheepMeter from '../../src/app/SheepMeter.svelte';
import type { Answer, Question } from '../../src/lib/types';

const opts = (t: string[]) => t.map((text, i) => ({ id: 'abcd'[i] as 'a', text }));

const questions: Record<string, Question> = {
  farm: {
    id: 'q-farm', type: 'farm', skill: 'motive',
    prompt: 'Що тут насправді відбувається?',
    material: { kind: 'telegram', channel: 'Новини Дня', text: 'Терміново! Всі мають побачити це.', views: '12K', time: '21:04' },
    options: opts(['Це реклама', 'Це новина', 'Це жарт']), correct: 'a',
    why: { options: opts(['Бо гарно написано', 'Бо є заклик ділитись', 'Бо багато переглядів']), correct: 'b' },
    explanation: 'Заклик «всі мають побачити» — ознака вірусного тексту.',
    verdictLine: 'Ти не бачиш мотиву.',
  },
  recall: {
    id: 'q-recall', type: 'recall', skill: 'detail',
    prompt: 'Що було на другому кліпі?',
    options: opts(['Кіт', 'Пес', 'Риба', 'Птах']), correct: 'b',
    explanation: 'На другому кліпі був пес.',
    verdictLine: 'Ти не помітив деталі.',
  },
  herd: {
    id: 'q-herd', type: 'herd', skill: 'herd',
    prompt: 'Яка відповідь правильна?',
    options: opts(['Перша', 'Друга', 'Третя']), correct: 'a',
    herd: { option: 'c', percent: 87 },
    why: { options: opts(['Я перевірив', 'Я вгадав']), correct: 'a' },
    explanation: 'Правильна — перша.',
    verdictLine: 'Ти пішов за натовпом.',
  },
  rewritten: {
    id: 'q-rew', type: 'rewritten', skill: 'detail',
    prompt: 'Що змінилось у дописі?',
    material: { kind: 'rewritten', channel: 'user_2', before: 'Зростання на 5% у 2024 році', after: 'Зростання на 15% у 2025 році' },
    options: opts(['Цифри', 'Нічого']), correct: 'a',
    explanation: 'Змінили цифри.',
    verdictLine: 'Ти не помітив правки.',
  },
};

const params = new URLSearchParams(location.search);
const q = questions[params.get('q') ?? 'farm'];
const theme = (params.get('theme') ?? 'feed-stop') as 'feed-stop' | 'paper';

const w = window as unknown as Record<string, unknown>;
w.__answers = [] as Answer[];

mount(QuestionScreen, {
  target: document.getElementById('app')!,
  props: { question: q, theme, index: 0, total: 3, onanswer: (a: Answer) => (w.__answers as Answer[]).push(a) },
});
mount(SheepMeter, { target: document.body, props: { value: Number(params.get('meter') ?? 40), theme } });
