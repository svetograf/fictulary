export enum BookStatus {
  NOT_READ = 'NOT_READ',
  READING = 'READING',
  READ = 'READ',
}

export const BOOK_FILE_MAX_SIZE = 1024 * 1024;
export const BOOK_NAME_MAX_LENGTH = 1000;
export const BOOK_DESCRIPTION_MAX_LENGTH = 5000;
export const BOOK_TOP_WORDS_LIMIT = 100;

export interface WordCount {
  word: string;
  count: number;
}

/** A book as shown in lists, without its words. */
export interface BookSummary {
  id: number;
  name: string;
  description: string | null;
  status: BookStatus;
  /** Total number of words in the uploaded text. */
  wordCount: number;
  /** Number of distinct words after grouping word forms. */
  uniqueWordCount: number;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface BookDetails extends BookSummary {
  /** Most frequent words (up to BOOK_TOP_WORDS_LIMIT), by count descending. */
  words: WordCount[];
}
