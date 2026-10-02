import { WordStatus } from './dictionary';

export const BOOK_FILE_MAX_SIZE = 1024 * 1024;
export const BOOK_NAME_MAX_LENGTH = 1000;
export const BOOK_DESCRIPTION_MAX_LENGTH = 5000;
export const BOOK_TOP_WORDS_LIMIT = 100;

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
}

export interface BookDetails extends BookSummary {
  /**
   * The book's most frequent words the reader is still learning or doesn't
   * know (up to BOOK_TOP_WORDS_LIMIT), by count descending. Known words are
   * left out.
   */
  words: WordCount[];
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
