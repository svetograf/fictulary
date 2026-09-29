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

export interface BookResult {
  id: number;
  name: string;
  description: string | null;
  status: BookStatus;
  /** Total number of words in the uploaded text. */
  wordCount: number;
  /** Number of distinct words after grouping word forms. */
  uniqueWordCount: number;
  /** Most frequent words, ordered by count descending. */
  words: WordCount[];
}
