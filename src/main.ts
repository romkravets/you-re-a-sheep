import './styles/tokens.css';
import './styles/base.css';
import { mount } from 'svelte';
import Experience from './app/Experience.svelte';
import { loadContent } from './lib/content';

mount(Experience, { target: document.getElementById('app')!, props: { content: loadContent() } });
