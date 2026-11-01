import '../../src/styles/tokens.css';
import { loadContent } from '../../src/lib/content';
import { levelFor } from '../../src/lib/levels';
import { prepareCardFonts, drawStoryCard, CARD_W, CARD_H } from '../../src/lib/storycard';

const content = loadContent();
const q = new URLSearchParams(location.search);
const percent = Number(q.get('percent') ?? 62);
const level = levelFor(percent, content.levels);
const canvas = document.getElementById('card') as HTMLCanvasElement;
canvas.width = CARD_W;
canvas.height = CARD_H;
const w = window as unknown as Record<string, unknown>;

await prepareCardFonts();
drawStoryCard(canvas.getContext('2d')!, { level, percent, siteLabel: content.ui.siteLabel });
w.__cardReady = true;
