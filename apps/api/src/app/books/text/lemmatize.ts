import { adjective, noun, verb } from 'wink-lemmatizer';

/**
 * Words whose dictionary lemma is technically right but surprising to readers
 * (e.g. "data" -> "datum"), so we keep them as they are.
 */
const OVERRIDES: Record<string, string> = {
  data: 'data',
  media: 'media',
};

const ENGLISH_WORD = /^[a-z]+$/;

/**
 * Maps an inflected English word to its base form using WordNet-backed rules
 * and exception lists: was/were/is -> be, phones -> phone, mice -> mouse.
 *
 * Without part-of-speech context we try verb, then noun, then adjective and
 * take the first form that changes the word. Verb goes first because the
 * irregular verbs (be, have, do, go) are the most frequent forms in any text,
 * and trying noun first would turn "does" into "doe". Words that are not plain
 * English letters are returned unchanged.
 */
export function lemmatize(word: string): string {
  const override = OVERRIDES[word];
  if (override) {
    return override;
  }
  if (!ENGLISH_WORD.test(word)) {
    return word;
  }
  for (const toBase of [verb, noun, adjective]) {
    const base = toBase(word);
    if (base !== word) {
      return base;
    }
  }
  return word;
}
