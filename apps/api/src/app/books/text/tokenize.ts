const WORD = /[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*/gu;
const APOSTROPHES = /[‘’ʼ`]/g;

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

/**
 * Splits text into lowercase words. Numbers and punctuation are dropped,
 * hyphenated words are split, and common English contractions are expanded
 * ("don't" -> "do", "not"; "they're" -> "they", "be").
 */
export function* tokenize(text: string): Generator<string> {
  const normalized = text.normalize('NFKC').replace(APOSTROPHES, "'");
  for (const [match] of normalized.toLowerCase().matchAll(WORD)) {
    yield* expandContraction(match);
  }
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
