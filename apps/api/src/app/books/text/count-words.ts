import { WORD_MAX_LENGTH } from '../entities/word.entity';
import { lemmatize } from './lemmatize';
import { tokenize } from './tokenize';

/** Share of mid-sentence uses that must be capitalized for a name. */
const NAME_CAPITALIZED_SHARE = 0.9;

export interface WordUsage {
  count: number;
  /** Uses not at the start of a sentence, with known casing. */
  midSentence: number;
  /** ...of which written with a capital letter. */
  midSentenceCapitalized: number;
}

export interface TextAnalysis {
  /** Total number of words in the text. */
  total: number;
  /** Usage per word as written (lowercased), before lemmatizing. */
  words: Map<string, WordUsage>;
}

export interface WordCounts {
  /** Total number of words in the text. */
  total: number;
  /** Occurrences per base word form; names are kept as written. */
  counts: Map<string, number>;
  /** Words of `counts` that are names. */
  names: Set<string>;
}

export function analyzeText(text: string): TextAnalysis {
  const words = new Map<string, WordUsage>();
  let total = 0;
  for (const { word, casing, sentenceStart } of tokenize(text)) {
    if (word.length > WORD_MAX_LENGTH) {
      continue;
    }
    let usage = words.get(word);
    if (!usage) {
      usage = { count: 0, midSentence: 0, midSentenceCapitalized: 0 };
      words.set(word, usage);
    }
    usage.count++;
    if (!sentenceStart && casing !== 'unknown') {
      usage.midSentence++;
      if (casing === 'capitalized') {
        usage.midSentenceCapitalized++;
      }
    }
    total++;
  }
  return { total, words };
}

/**
 * Words the text treats as proper nouns: capitalized (nearly) every time
 * they appear mid-sentence. "Tom" qualifies; "will" doesn't, even though
 * Will is a name. Only these are looked up in the names list.
 */
export function nameCandidates(analysis: TextAnalysis): string[] {
  return [...analysis.words]
    .filter(
      ([, usage]) =>
        usage.midSentence > 0 &&
        usage.midSentenceCapitalized / usage.midSentence >=
          NAME_CAPITALIZED_SHARE,
    )
    .map(([word]) => word);
}

/**
 * Counts words, grouping inflected forms under their base form so that
 * "be", "was" and "were" are counted as one word. Names are kept as written:
 * lemmatizing would turn "Wales" into "wale" and "Rogers" into "roger".
 */
export function countWords(
  analysis: TextAnalysis,
  names: ReadonlySet<string> = new Set(),
): WordCounts {
  const counts = new Map<string, number>();
  const found = new Set<string>();
  for (const [word, { count }] of analysis.words) {
    const isName = names.has(word);
    const key = isName ? word : lemmatize(word);
    if (isName) {
      found.add(key);
    }
    counts.set(key, (counts.get(key) ?? 0) + count);
  }
  return { total: analysis.total, counts, names: found };
}
