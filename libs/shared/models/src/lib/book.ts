import { WordStatus } from './dictionary';

export const BOOK_FILE_MAX_SIZE = 1024 * 1024;
export const BOOK_NAME_MAX_LENGTH = 1000;
export const BOOK_DESCRIPTION_MAX_LENGTH = 5000;
export const BOOK_TOP_WORDS_LIMIT = 100;
/** Largest page of a book's words to learn. */
export const BOOK_WORDS_MAX_PAGE_SIZE = 100;

/** CEFR levels a user can say they know, lowest first. */
export enum CefrLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
}

export const CEFR_LEVELS: readonly CefrLevel[] = Object.values(CefrLevel);

/** A word of a book that the reader hasn't learned yet. */
export interface WordCount {
  /** Word ids are bigints, so they travel as strings. */
  wordId: string;
  word: string;
  count: number;
  /** The reader's status for the word: only LEARNING or UNKNOWN. */
  status: WordStatus;
}

/** A book as shown in lists, without its words. */
export interface BookSummary {
  id: number;
  name: string;
  description: string | null;
  /** Total number of words in the uploaded text. */
  wordCount: number;
  /** Number of distinct words after grouping word forms. */
  uniqueWordCount: number;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /**
   * Set for the user's knowledge-level word list ("B1 vocabulary": the
   * CEFR-J words up to that level), null for an uploaded book. Word lists
   * are left out of word statistics.
   */
  level: CefrLevel | null;
}

export interface BookDetails extends BookSummary {
  /**
   * The book's most frequent words the reader is still learning or doesn't
   * know (up to BOOK_TOP_WORDS_LIMIT), by count descending. Known words are
   * left out.
   */
  words: WordCount[];
  /** All of the book's words to learn, for paging past `words`. */
  wordsToLearnCount: number;
}

/** Multipart fields sent with the uploaded file to `POST /api/book`. */
export interface UploadBookFields {
  name: string;
  description?: string;
  /**
   * How well the uploader knows the book: words new to their dictionary get
   * this status, and KNOWN ("I've read it") also upgrades words already in it.
   */
  wordStatus: WordStatus;
}

/** The response to an upload: the processed book. */
export interface UploadedBook extends BookDetails {
  /**
   * Words of the book that were put in the uploader's dictionary as names
   * (found in the names list and capitalized in the text), most used first.
   */
  markedAsNames: string[];
}

/** A page of a book's words to learn, most used first. */
export interface BookWordsPage {
  items: WordCount[];
  /** All of the book's words to learn. */
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
}

/**
 * `PUT /api/level`: replaces the user's knowledge-level word list with the
 * words up to `level`, or removes it for null. Either way the user has
 * answered the level prompt. Responds with the list, or null.
 */
export interface SetLevelRequest {
  level: CefrLevel | null;
}
