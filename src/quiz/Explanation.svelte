<script lang="ts">
  import type { Option, Question } from '../lib/types';

  interface Props { question: Question; chosen: Option['id']; whyChosen?: Option['id']; onnext: () => void }
  let { question, chosen, whyChosen, onnext }: Props = $props();

  const text = (id: Option['id']) => question.options.find((o) => o.id === id)?.text ?? '';
  const ok = $derived(chosen === question.correct);
  const whyOk = $derived(!question.why || whyChosen === undefined || whyChosen === question.why.correct);
  const whyCorrectText = $derived(question.why?.options.find((o) => o.id === question.why!.correct)?.text ?? '');
  const isHerd = $derived(question.type === 'herd' || !!question.herd);
</script>

<section class="ex" data-testid="explanation">
  {#if !ok}
    <h2>❌ Неправильно</h2>
    <p>Ти обрав: <strong>{text(chosen)}</strong></p>
    <p>Правильно: <strong>{text(question.correct)}</strong></p>
  {:else if !whyOk}
    <h2>✅ Так, але причина інша</h2>
    <p>Причина: <strong>{whyCorrectText}</strong></p>
  {:else}
    <h2>✅ Так</h2>
  {/if}
  <p>{question.explanation}</p>
  {#if isHerd}<p class="trap">Цієї цифри не було — це пастка.</p>{/if}
  <button type="button" class="next" data-testid="next" onclick={onnext}>Далі →</button>
</section>

<style>
  .ex { margin-top: 1rem; }
  h2 { margin: 0 0 0.6rem; font-size: 1.3rem; }
  p { margin: 0.3rem 0; line-height: 1.5; }
  .trap { font-weight: 700; }
  .next { margin-top: 1rem; font: inherit; font-weight: 700; padding: 0.7rem 1.4rem; border-radius: 999px; border: 2px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
</style>
