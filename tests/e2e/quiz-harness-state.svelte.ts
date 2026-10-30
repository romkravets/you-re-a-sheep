import type { Question } from '../../src/lib/types';

export const harness: { question: Question } = $state({ question: undefined as unknown as Question });
