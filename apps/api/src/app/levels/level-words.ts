import { CEFR_LEVELS, CefrLevel } from '@fictulary/shared/models';
import { WORD_MAX_LENGTH } from '../books/entities/word.entity';
import { lemmatize } from '../books/text/lemmatize';
import snapshot from './data/cefrj-v1.json';

const cache = new Map<CefrLevel, ReadonlySet<string>>();

/**
 * The CEFR-J words up to and including `level` (B1 includes A1 and A2), as
 * base forms grouped the way book words are, so they match books' words.
 */
export function levelWords(level: CefrLevel): ReadonlySet<string> {
  let words = cache.get(level);
  if (!words) {
    const levels = CEFR_LEVELS.slice(0, CEFR_LEVELS.indexOf(level) + 1);
    words = new Set(
      levels
        .flatMap((l) => snapshot.levels[l])
        .map(lemmatize)
        .filter((word) => word.length <= WORD_MAX_LENGTH),
    );
    cache.set(level, words);
  }
  return words;
}
