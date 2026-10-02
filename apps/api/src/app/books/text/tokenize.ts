const WORD = /[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*/gu;
const APOSTROPHES = /[‘’ʼ`]/g;
const SENTENCE_END = /[.!?…]/;
const PARAGRAPH_BREAK = /\n\s*\n/;
/** A period after these doesn't end a sentence ("Mr. Thatcher"). */
const ABBREVIATIONS = new Set(
  'mr mrs ms dr st jr sr capt col gen lt sgt rev prof hon gov pres messrs mme mlle'.split(
    ' ',
  ),
);

const NEGATIONS: Record<string, string> = {
  "can't": 'can',
  "won't": 'will',
  "shan't": 'shall',
  "ain't": 'be',
};

const SUFFIXES: [suffix: string, expansion: string | null][] = [
  ["n't", 'not'],
  ["'re", 'be'],
  ["'m", 'be'],
  ["'ll", 'will'],
  ["'ve", 'have'],
  ["'d", 'would'],
  // Possessive or "is": ambiguous, so keep just the base word.
  ["'s", null],
];

export interface Token {
  /** The word, lowercased. */
  word: string;
  /**
   * How the word was written: `capitalized` ("Tom"), `lower` ("tom"), or
   * `unknown` when the text doesn't say (ALL CAPS, or words added by
   * expanding a contraction).
   */
  casing: 'capitalized' | 'lower' | 'unknown';
  /** First word of a sentence, where capitals tell nothing about names. */
  sentenceStart: boolean;
}

/**
 * Splits text into words. Numbers and punctuation are dropped, hyphenated
 * words are split, and common English contractions are expanded ("don't" ->
 * "do", "not"; "they're" -> "they", "be"). Each word notes its casing and
 * whether it starts a sentence, which is how names are recognized.
 */
export function* tokenize(text: string): Generator<Token> {
  const normalized = text.normalize('NFKC').replace(APOSTROPHES, "'");
  let previousEnd = 0;
  let previousWord: string | null = null;

  for (const match of normalized.matchAll(WORD)) {
    const raw = match[0];
    const gap = normalized.slice(previousEnd, match.index);
    const sentenceStart =
      previousWord === null ||
      PARAGRAPH_BREAK.test(gap) ||
      (SENTENCE_END.test(gap) &&
        !(gap.startsWith('.') && ABBREVIATIONS.has(previousWord)));
    previousEnd = match.index + raw.length;
    previousWord = raw.toLowerCase();

    const [first, ...added] = expandContraction(raw.toLowerCase());
    yield { word: first, casing: casingOf(raw), sentenceStart };
    for (const word of added) {
      yield { word, casing: 'unknown', sentenceStart: false };
    }
  }
}

function casingOf(raw: string): Token['casing'] {
  const letters = raw.replace(/'/g, '');
  if (letters.length > 1 && letters === letters.toUpperCase()) {
    return 'unknown'; // ALL CAPS: headings, shouting
  }
  return raw[0] === raw[0].toLowerCase() ? 'lower' : 'capitalized';
}

function expandContraction(token: string): string[] {
  if (!token.includes("'")) {
    return [token];
  }
  const negation = NEGATIONS[token];
  if (negation) {
    return [negation, 'not'];
  }
  for (const [suffix, expansion] of SUFFIXES) {
    if (token.endsWith(suffix) && token.length > suffix.length) {
      const base = token.slice(0, -suffix.length);
      return expansion ? [base, expansion] : [base];
    }
  }
  // e.g. "o'clock", "rock'n'roll"
  return [token];
}
