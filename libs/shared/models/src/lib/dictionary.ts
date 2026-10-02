/** How well a user knows a word, or why it isn't worth learning. */
export enum WordStatus {
  KNOWN = 'KNOWN',
  LEARNING = 'LEARNING',
  UNKNOWN = 'UNKNOWN',
  /** Not a real word: a typo or a word cut off by mistake. */
  TRASH = 'TRASH',
  /** Used as the name of a person or place. */
  NAME = 'NAME',
}

/** Statuses an upload can give a book's words ("have you read it?"). */
export const READING_STATUSES: readonly WordStatus[] = [
  WordStatus.KNOWN,
  WordStatus.LEARNING,
  WordStatus.UNKNOWN,
];

/** Words shown in a book's "words to learn"; others are left out. */
export const WORDS_TO_LEARN_STATUSES: readonly WordStatus[] = [
  WordStatus.LEARNING,
  WordStatus.UNKNOWN,
];

/** What a known name names. */
export enum NameKind {
  PERSON = 'PERSON',
  CITY = 'CITY',
  COUNTRY = 'COUNTRY',
  LAKE = 'LAKE',
}

export const DICTIONARY_DEFAULT_PAGE_SIZE = 50;
export const DICTIONARY_MAX_PAGE_SIZE = 100;

/** A word in the user's dictionary, with usage across their books. */
export interface DictionaryWord {
  /** Word ids are bigints, so they travel as strings. */
  wordId: string;
  word: string;
  status: WordStatus;
  /** Occurrences across all of the user's books. */
  count: number;
  /** Number of the user's books containing the word. */
  bookCount: number;
}

export interface DictionaryPage {
  items: DictionaryWord[];
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export interface WordBookUsage {
  bookId: number;
  name: string;
  count: number;
}

export interface DictionaryWordDetails extends DictionaryWord {
  /** Per-book usage, most frequent first. */
  books: WordBookUsage[];
  /** What the word names, if it's in the names list (may be several). */
  nameKinds: NameKind[];
}

export interface UpdateWordStatusRequest {
  status: WordStatus;
}

/** A dictionary article from WordNet. */
export interface WordDefinition {
  word: string;
  /** Senses grouped by part of speech, most common first. */
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; examples: string[] }[];
    /** Other words sharing these senses. */
    synonyms: string[];
  }[];
  /** Attribution required by the WordNet license. */
  source: { name: string; url: string };
  license: { name: string; url: string };
}
