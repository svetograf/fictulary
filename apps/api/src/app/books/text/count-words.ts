import { WORD_MAX_LENGTH } from '../entities/word.entity';
import { lemmatize } from './lemmatize';
import { tokenize } from './tokenize';

export interface WordCounts {
  /** Total number of words in the text. */
  total: number;
  /** Occurrences per base word form. */
  counts: Map<string, number>;
}

/**
 * Counts words in the text, grouping inflected forms under their base form
 * so that "be", "was" and "were" are counted as one word.
 */
export function countWords(text: string): WordCounts {
  const lemmas = new Map<string, string>();
  const counts = new Map<string, number>();
  let total = 0;

  for (const token of tokenize(text)) {
    if (token.length > WORD_MAX_LENGTH) {
      continue;
    }
    let lemma = lemmas.get(token);
    if (lemma === undefined) {
      lemma = lemmatize(token);
      lemmas.set(token, lemma);
    }
    counts.set(lemma, (counts.get(lemma) ?? 0) + 1);
    total++;
  }

  return { total, counts };
}
