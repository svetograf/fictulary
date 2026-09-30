import {
  DictionaryPage,
  DictionaryWord,
  DictionaryWordDetails,
  WordDefinition,
  WordStatus,
} from '@fictulary/shared/models';

/** What's needed to open a word: from the dictionary or a book's list. */
export type WordRef = Pick<DictionaryWord, 'wordId' | 'word' | 'status'>;

export interface DictionaryQuery {
  status: WordStatus;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export class LoadDictionary {
  static readonly type = '[Dictionary] LOAD_DICTIONARY';
  constructor(public readonly query: DictionaryQuery) {}
}

export class LoadDictionarySuccess {
  static readonly type = '[Dictionary] LOAD_DICTIONARY_SUCCESS';
  constructor(public readonly page: DictionaryPage) {}
}

export class LoadDictionaryFail {
  static readonly type = '[Dictionary] LOAD_DICTIONARY_FAIL';
  constructor(public readonly error: string) {}
}

export class ChangeWordStatus {
  static readonly type = '[Dictionary] CHANGE_WORD_STATUS';
  constructor(
    public readonly wordId: string,
    public readonly status: WordStatus,
  ) {}
}

export class ChangeWordStatusSuccess {
  static readonly type = '[Dictionary] CHANGE_WORD_STATUS_SUCCESS';
  constructor(public readonly word: DictionaryWord) {}
}

export class ChangeWordStatusFail {
  static readonly type = '[Dictionary] CHANGE_WORD_STATUS_FAIL';
  constructor(
    public readonly wordId: string,
    public readonly error: string,
  ) {}
}

/**
 * Opens a word's details: loads its per-book stats and dictionary article,
 * and marks it viewed (UNKNOWN becomes LEARNING).
 */
export class OpenWord {
  static readonly type = '[Dictionary] OPEN_WORD';
  constructor(public readonly word: WordRef) {}
}

export class CloseWord {
  static readonly type = '[Dictionary] CLOSE_WORD';
}

export class LoadWordDetails {
  static readonly type = '[Dictionary] LOAD_WORD_DETAILS';
  constructor(public readonly wordId: string) {}
}

export class LoadWordDetailsSuccess {
  static readonly type = '[Dictionary] LOAD_WORD_DETAILS_SUCCESS';
  constructor(public readonly details: DictionaryWordDetails) {}
}

export class LoadWordDetailsFail {
  static readonly type = '[Dictionary] LOAD_WORD_DETAILS_FAIL';
  constructor(public readonly error: string) {}
}

export class LoadDefinition {
  static readonly type = '[Dictionary] LOAD_DEFINITION';
  constructor(public readonly word: string) {}
}

export class LoadDefinitionSuccess {
  static readonly type = '[Dictionary] LOAD_DEFINITION_SUCCESS';
  constructor(public readonly definition: WordDefinition) {}
}

export class LoadDefinitionFail {
  static readonly type = '[Dictionary] LOAD_DEFINITION_FAIL';
  constructor(public readonly error: string) {}
}

export class MarkWordViewed {
  static readonly type = '[Dictionary] MARK_WORD_VIEWED';
  constructor(public readonly wordId: string) {}
}

export class MarkWordViewedSuccess {
  static readonly type = '[Dictionary] MARK_WORD_VIEWED_SUCCESS';
  constructor(public readonly word: DictionaryWord) {}
}

export class MarkWordViewedFail {
  static readonly type = '[Dictionary] MARK_WORD_VIEWED_FAIL';
  constructor(public readonly error: string) {}
}
