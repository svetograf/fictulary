import { Injectable } from '@angular/core';
import { WordStatus } from '@fictulary/shared/models';
import { dispatch } from '@ngxs/store';
import {
  ChangeWordStatus,
  CloseWord,
  DictionaryQuery,
  LoadDefinition,
  LoadDictionary,
  LoadWordDetails,
  OpenWord,
  WordRef,
} from './dictionary.actions';

/**
 * Entry point for components to trigger dictionary actions. API calls live
 * in DictionaryState; read data through its selectors.
 */
@Injectable({ providedIn: 'root' })
export class DictionaryService {
  private readonly dispatchLoad = dispatch(LoadDictionary);
  private readonly dispatchChangeStatus = dispatch(ChangeWordStatus);
  private readonly dispatchOpen = dispatch(OpenWord);
  private readonly dispatchClose = dispatch(CloseWord);
  private readonly dispatchLoadDetails = dispatch(LoadWordDetails);
  private readonly dispatchLoadDefinition = dispatch(LoadDefinition);

  load(query: DictionaryQuery) {
    return this.dispatchLoad(query);
  }

  changeStatus(wordId: string, status: WordStatus) {
    return this.dispatchChangeStatus(wordId, status);
  }

  openWord(word: WordRef) {
    return this.dispatchOpen(word);
  }

  closeWord() {
    return this.dispatchClose();
  }

  retryDetails(wordId: string) {
    return this.dispatchLoadDetails(wordId);
  }

  retryDefinition(word: string) {
    return this.dispatchLoadDefinition(word);
  }
}
