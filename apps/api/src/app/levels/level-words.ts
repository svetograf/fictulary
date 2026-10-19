import { CEFR_LEVELS, CefrLevel } from '@fictulary/shared/models';
import { WORD_MAX_LENGTH } from '../books/entities/word.entity';
import { lemmatize } from '../books/text/lemmatize';
import snapshot from './data/cefrj-v1.json';

let levels: ReadonlyMap<string, CefrLevel> | null = null;
const cache = new Map<CefrLevel, ReadonlySet<string>>();

/**
 * Each CEFR-J word's level, by base form grouped the way book words are,
 * so they match books' words. A base form of words at several levels
 * ("glasses" A1, "glass" B1) gets the lowest.
 */
function wordLevels(): ReadonlyMap<string, CefrLevel> {
  if (!levels) {
    const map = new Map<string, CefrLevel>();
    // Lowest level first, so the first one seen wins.
    for (const level of CEFR_LEVELS) {
      for (const word of snapshot.levels[level].map(lemmatize)) {
        if (word.length <= WORD_MAX_LENGTH && !map.has(word)) {
          map.set(word, level);
        }
      }
    }
    levels = map;
  }
  return levels;
}

/** The CEFR-J words up to and including `level` (B1 includes A1 and A2). */
export function levelWords(level: CefrLevel): ReadonlySet<string> {
  let words = cache.get(level);
  if (!words) {
    const max = CEFR_LEVELS.indexOf(level);
    words = new Set(
      [...wordLevels()]
        .filter(([, l]) => CEFR_LEVELS.indexOf(l) <= max)
        .map(([word]) => word),
    );
    cache.set(level, words);
  }
  return words;
}

/** The lowest CEFR-J level of a (base form) word, or null if unlisted. */
export function wordLevel(word: string): CefrLevel | null {
  return wordLevels().get(word) ?? null;
}
