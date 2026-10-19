import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  DICTIONARY_DEFAULT_PAGE_SIZE,
  DictionaryPage,
  DictionaryWord,
  DictionaryWordDetails,
  UpdateWordStatusRequest,
  WordDefinition,
  WordStatus,
} from '@fictulary/shared/models';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { catchError, forkJoin, mergeMap } from 'rxjs';
import { SignOut } from '../auth/auth.actions';
import { httpErrorMessage } from '../shared/http-error-message';
import {
  ChangeWordStatus,
  ChangeWordStatusFail,
  ChangeWordStatusSuccess,
  CloseWord,
  DictionaryQuery,
  LoadDefinition,
  LoadDefinitionFail,
  LoadDefinitionSuccess,
  LoadDictionary,
  LoadDictionaryFail,
  LoadDictionarySuccess,
  LoadWordDetails,
  LoadWordDetailsFail,
  LoadWordDetailsSuccess,
  MarkWordViewed,
  MarkWordViewedFail,
  MarkWordViewedSuccess,
  OpenWord,
  WordRef,
} from './dictionary.actions';

export interface DictionaryStateModel {
  query: DictionaryQuery;
  items: DictionaryWord[];
  total: number;
  loading: boolean;
  error: string | null;
  /** Words with a status change in flight. */
  pendingWordIds: string[];
  /** The word open in the details dialog. */
  word: {
    current: WordRef | null;
    details: DictionaryWordDetails | null;
    loading: boolean;
    error: string | null;
  };
  definition: {
    value: WordDefinition | null;
    loading: boolean;
    error: string | null;
  };
}

const initialWord: DictionaryStateModel['word'] = {
  current: null,
  details: null,
  loading: false,
  error: null,
};
const initialDefinition: DictionaryStateModel['definition'] = {
  value: null,
  loading: false,
  error: null,
};
const defaults: DictionaryStateModel = {
  query: {
    status: WordStatus.KNOWN,
    page: 1,
    pageSize: DICTIONARY_DEFAULT_PAGE_SIZE,
    bookWordsOnly: true,
  },
  items: [],
  total: 0,
  loading: false,
  error: null,
  pendingWordIds: [],
  word: initialWord,
  definition: initialDefinition,
};

type Ctx = StateContext<DictionaryStateModel>;

@State<DictionaryStateModel>({ name: 'dictionary', defaults })
@Injectable()
export class DictionaryState {
  private readonly http = inject(HttpClient);

  @Selector()
  static query(state: DictionaryStateModel): DictionaryQuery {
    return state.query;
  }

  @Selector()
  static items(state: DictionaryStateModel): DictionaryWord[] {
    return state.items;
  }

  @Selector()
  static total(state: DictionaryStateModel): number {
    return state.total;
  }

  @Selector()
  static loading(state: DictionaryStateModel): boolean {
    return state.loading;
  }

  @Selector()
  static error(state: DictionaryStateModel): string | null {
    return state.error;
  }

  @Selector()
  static pendingWordIds(state: DictionaryStateModel): string[] {
    return state.pendingWordIds;
  }

  /** The open word, with its latest status. */
  @Selector()
  static currentWord(state: DictionaryStateModel): WordRef | null {
    return state.word.current;
  }

  @Selector()
  static wordDetails(
    state: DictionaryStateModel,
  ): DictionaryWordDetails | null {
    return state.word.details;
  }

  @Selector()
  static wordDetailsLoading(state: DictionaryStateModel): boolean {
    return state.word.loading;
  }

  @Selector()
  static wordDetailsError(state: DictionaryStateModel): string | null {
    return state.word.error;
  }

  @Selector()
  static definition(state: DictionaryStateModel): WordDefinition | null {
    return state.definition.value;
  }

  @Selector()
  static definitionLoading(state: DictionaryStateModel): boolean {
    return state.definition.loading;
  }

  @Selector()
  static definitionError(state: DictionaryStateModel): string | null {
    return state.definition.error;
  }

  @Action(LoadDictionary, { cancelUncompleted: true })
  loadDictionary(ctx: Ctx, { query }: LoadDictionary) {
    const shown = ctx.getState().query;
    const sameList =
      shown.status === query.status &&
      shown.pageSize === query.pageSize &&
      shown.bookWordsOnly === query.bookWordsOnly;
    // Keep the current rows while refreshing the same list; clear them when
    // switching filters so the old list doesn't flash under the new one.
    ctx.patchState({
      query,
      loading: true,
      error: null,
      ...(sameList ? {} : { items: [], total: 0 }),
    });
    const params = new HttpParams({
      fromObject: {
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
        bookWordsOnly: query.bookWordsOnly,
      },
    });
    return this.http.get<DictionaryPage>('/api/my-dictionary', { params }).pipe(
      mergeMap((page) => ctx.dispatch(new LoadDictionarySuccess(page))),
      catchError((error: HttpErrorResponse) =>
        ctx.dispatch(new LoadDictionaryFail(httpErrorMessage(error))),
      ),
    );
  }

  @Action(LoadDictionarySuccess)
  loadDictionarySuccess(ctx: Ctx, { page }: LoadDictionarySuccess) {
    const { query } = ctx.getState();
    // Past the last page (e.g. its last word was just moved away): go back.
    const lastPage = Math.max(1, Math.ceil(page.total / query.pageSize));
    if (page.items.length === 0 && query.page > lastPage) {
      return ctx.dispatch(new LoadDictionary({ ...query, page: lastPage }));
    }
    ctx.patchState({ items: page.items, total: page.total, loading: false });
    return undefined;
  }

  @Action(LoadDictionaryFail)
  loadDictionaryFail(ctx: Ctx, { error }: LoadDictionaryFail) {
    ctx.patchState({ loading: false, error });
  }

  @Action(ChangeWordStatus)
  changeWordStatus(ctx: Ctx, { wordId, status }: ChangeWordStatus) {
    ctx.patchState({
      pendingWordIds: [...ctx.getState().pendingWordIds, wordId],
    });
    const body: UpdateWordStatusRequest = { status };
    return this.http
      .patch<DictionaryWord>(`/api/my-dictionary/${wordId}`, body)
      .pipe(
        mergeMap((word) => ctx.dispatch(new ChangeWordStatusSuccess(word))),
        catchError((error: HttpErrorResponse) =>
          ctx.dispatch(
            new ChangeWordStatusFail(wordId, httpErrorMessage(error)),
          ),
        ),
      );
  }

  @Action([ChangeWordStatusSuccess, MarkWordViewedSuccess])
  wordStatusChanged(
    ctx: Ctx,
    { word }: ChangeWordStatusSuccess | MarkWordViewedSuccess,
  ) {
    const state = ctx.getState();
    const current = state.word.current;
    const inList = state.items.some((item) => item.wordId === word.wordId);
    ctx.patchState({
      pendingWordIds: state.pendingWordIds.filter((id) => id !== word.wordId),
      word:
        current?.wordId === word.wordId
          ? {
              ...state.word,
              current: word,
              details: state.word.details && {
                ...state.word.details,
                status: word.status,
              },
            }
          : state.word,
    });
    // The word left the list's status: refresh so the page fills back up.
    if (inList && word.status !== state.query.status) {
      ctx.patchState({
        items: state.items.filter((item) => item.wordId !== word.wordId),
        total: state.total - 1,
      });
      return ctx.dispatch(new LoadDictionary(state.query));
    }
    return undefined;
  }

  /** The error itself is shown by notifyWordStatusErrors. */
  @Action(ChangeWordStatusFail)
  changeWordStatusFail(ctx: Ctx, { wordId }: ChangeWordStatusFail) {
    ctx.patchState({
      pendingWordIds: ctx
        .getState()
        .pendingWordIds.filter((id) => id !== wordId),
    });
  }

  @Action(OpenWord)
  openWord(ctx: Ctx, { word }: OpenWord) {
    ctx.patchState({
      word: { ...initialWord, current: word },
      definition: initialDefinition,
    });
    const loads = [
      ctx.dispatch(new LoadWordDetails(word.wordId)),
      ctx.dispatch(new LoadDefinition(word.word)),
    ];
    if (word.status === WordStatus.UNKNOWN) {
      loads.push(ctx.dispatch(new MarkWordViewed(word.wordId)));
    }
    return forkJoin(loads);
  }

  @Action(CloseWord)
  closeWord(ctx: Ctx) {
    ctx.patchState({ word: initialWord, definition: initialDefinition });
  }

  @Action(LoadWordDetails, { cancelUncompleted: true })
  loadWordDetails(ctx: Ctx, { wordId }: LoadWordDetails) {
    ctx.patchState({
      word: { ...ctx.getState().word, loading: true, error: null },
    });
    return this.http
      .get<DictionaryWordDetails>(`/api/my-dictionary/${wordId}`)
      .pipe(
        mergeMap((details) =>
          ctx.dispatch(new LoadWordDetailsSuccess(details)),
        ),
        catchError((error: HttpErrorResponse) =>
          ctx.dispatch(new LoadWordDetailsFail(httpErrorMessage(error))),
        ),
      );
  }

  @Action(LoadWordDetailsSuccess)
  loadWordDetailsSuccess(ctx: Ctx, { details }: LoadWordDetailsSuccess) {
    const { word } = ctx.getState();
    // Ignore a late response for a word that's no longer open.
    if (word.current?.wordId !== details.wordId) {
      return;
    }
    ctx.patchState({
      word: {
        ...word,
        // A pending "viewed" update may have changed the status already.
        details: { ...details, status: word.current.status },
        loading: false,
      },
    });
  }

  @Action(LoadWordDetailsFail)
  loadWordDetailsFail(ctx: Ctx, { error }: LoadWordDetailsFail) {
    ctx.patchState({
      word: { ...ctx.getState().word, loading: false, error },
    });
  }

  @Action(LoadDefinition, { cancelUncompleted: true })
  loadDefinition(ctx: Ctx, { word }: LoadDefinition) {
    ctx.patchState({
      definition: { value: null, loading: true, error: null },
    });
    return this.http
      .get<WordDefinition>(`/api/definitions/${encodeURIComponent(word)}`)
      .pipe(
        mergeMap((definition) =>
          ctx.dispatch(new LoadDefinitionSuccess(definition)),
        ),
        catchError((error: HttpErrorResponse) =>
          ctx.dispatch(new LoadDefinitionFail(httpErrorMessage(error))),
        ),
      );
  }

  @Action(LoadDefinitionSuccess)
  loadDefinitionSuccess(ctx: Ctx, { definition }: LoadDefinitionSuccess) {
    ctx.patchState({
      definition: { value: definition, loading: false, error: null },
    });
  }

  @Action(LoadDefinitionFail)
  loadDefinitionFail(ctx: Ctx, { error }: LoadDefinitionFail) {
    ctx.patchState({ definition: { value: null, loading: false, error } });
  }

  @Action(MarkWordViewed)
  markWordViewed(ctx: Ctx, { wordId }: MarkWordViewed) {
    return this.http
      .post<DictionaryWord>(`/api/my-dictionary/${wordId}/view`, null)
      .pipe(
        mergeMap((word) => ctx.dispatch(new MarkWordViewedSuccess(word))),
        catchError((error: HttpErrorResponse) =>
          ctx.dispatch(new MarkWordViewedFail(httpErrorMessage(error))),
        ),
      );
  }

  @Action(MarkWordViewedFail)
  markWordViewedFail() {
    // Not worth interrupting the user: the word just keeps its status.
  }

  @Action(SignOut)
  signOut(ctx: Ctx) {
    ctx.setState(defaults);
  }
}
