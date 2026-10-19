import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WordStatus } from '@fictulary/shared/models';
import { Actions, Store, ofActionDispatched, provideStore } from '@ngxs/store';
import { SignOut } from '../auth/auth.actions';
import {
  ChangeWordStatus,
  ChangeWordStatusFail,
  CloseWord,
  LoadDictionary,
  OpenWord,
} from './dictionary.actions';
import { DictionaryState } from './dictionary.state';
import { phone, phoneDefinition, phoneDetails, word } from './testing';

describe('DictionaryState', () => {
  let store: Store;
  let http: HttpTestingController;
  const known = {
    status: WordStatus.KNOWN,
    page: 1,
    pageSize: 2,
    bookWordsOnly: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideStore([DictionaryState]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const listRequest = () =>
    http.expectOne((req) => req.url === '/api/my-dictionary');

  const loadKnown = (items = [word('1'), word('2')], total = 3) => {
    store.dispatch(new LoadDictionary(known));
    listRequest().flush({ items, total, page: 1, pageSize: 2 });
  };

  it('loads a filtered, paginated page', () => {
    store.dispatch(
      new LoadDictionary({
        status: WordStatus.LEARNING,
        page: 3,
        pageSize: 25,
        bookWordsOnly: false,
      }),
    );
    expect(store.selectSnapshot(DictionaryState.loading)).toBe(true);

    const req = listRequest();
    expect(req.request.params.get('status')).toBe('LEARNING');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('pageSize')).toBe('25');
    expect(req.request.params.get('bookWordsOnly')).toBe('false');
    req.flush({
      items: [word('1', WordStatus.LEARNING)],
      total: 51,
      page: 3,
      pageSize: 25,
    });

    expect(store.selectSnapshot(DictionaryState.items)).toHaveLength(1);
    expect(store.selectSnapshot(DictionaryState.total)).toBe(51);
    expect(store.selectSnapshot(DictionaryState.loading)).toBe(false);
  });

  it('records load errors', () => {
    store.dispatch(new LoadDictionary(known));
    listRequest().flush(
      { message: 'Boom' },
      { status: 500, statusText: 'Error' },
    );
    expect(store.selectSnapshot(DictionaryState.error)).toBe('Boom');
  });

  it('steps back when the requested page is past the end', () => {
    store.dispatch(new LoadDictionary({ ...known, page: 5 }));
    listRequest().flush({ items: [], total: 3, page: 5, pageSize: 2 });

    const retry = listRequest();
    expect(retry.request.params.get('page')).toBe('2');
    retry.flush({ items: [word('3')], total: 3, page: 2, pageSize: 2 });
    expect(store.selectSnapshot(DictionaryState.query).page).toBe(2);
  });

  it('moves a word to another status and refills the page', () => {
    loadKnown();

    store.dispatch(new ChangeWordStatus('1', WordStatus.LEARNING));
    expect(store.selectSnapshot(DictionaryState.pendingWordIds)).toEqual(['1']);
    const patch = http.expectOne('/api/my-dictionary/1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'LEARNING' });
    patch.flush(word('1', WordStatus.LEARNING));

    // Removed right away, then the page is reloaded to fill the gap.
    expect(
      store.selectSnapshot(DictionaryState.items).map((w) => w.wordId),
    ).toEqual(['2']);
    expect(store.selectSnapshot(DictionaryState.total)).toBe(2);
    expect(store.selectSnapshot(DictionaryState.pendingWordIds)).toEqual([]);
    listRequest().flush({
      items: [word('2'), word('3')],
      total: 2,
      page: 1,
      pageSize: 2,
    });
    expect(
      store.selectSnapshot(DictionaryState.items).map((w) => w.wordId),
    ).toEqual(['2', '3']);
  });

  it('reports failed status changes', () => {
    const failures: ChangeWordStatusFail[] = [];
    TestBed.inject(Actions)
      .pipe(ofActionDispatched(ChangeWordStatusFail))
      .subscribe((action) => failures.push(action));
    loadKnown();
    store.dispatch(new ChangeWordStatus('1', WordStatus.UNKNOWN));
    http
      .expectOne('/api/my-dictionary/1')
      .flush(
        { message: 'Word 1 is not in your dictionary' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(failures).toEqual([
      new ChangeWordStatusFail('1', 'Word 1 is not in your dictionary'),
    ]);
    expect(store.selectSnapshot(DictionaryState.pendingWordIds)).toEqual([]);
    expect(store.selectSnapshot(DictionaryState.items)).toHaveLength(2);
  });

  describe('OpenWord', () => {
    it('loads stats and the article, and marks an UNKNOWN word as viewed', () => {
      store.dispatch(
        new LoadDictionary({ ...known, status: WordStatus.UNKNOWN }),
      );
      listRequest().flush({ items: [phone], total: 1, page: 1, pageSize: 2 });

      store.dispatch(new OpenWord(phone));
      expect(store.selectSnapshot(DictionaryState.currentWord)).toEqual(phone);

      http.expectOne('/api/my-dictionary/12').flush(phoneDetails);
      http.expectOne('/api/definitions/phone').flush(phoneDefinition);
      const view = http.expectOne('/api/my-dictionary/12/view');
      expect(view.request.method).toBe('POST');
      view.flush({ ...phone, status: WordStatus.LEARNING });

      expect(store.selectSnapshot(DictionaryState.currentWord)?.status).toBe(
        WordStatus.LEARNING,
      );
      expect(store.selectSnapshot(DictionaryState.wordDetails)?.status).toBe(
        WordStatus.LEARNING,
      );
      expect(
        store.selectSnapshot(DictionaryState.wordDetails)?.books,
      ).toHaveLength(2);
      expect(store.selectSnapshot(DictionaryState.definition)).toEqual(
        phoneDefinition,
      );

      // It left the UNKNOWN list, which is refreshed.
      expect(store.selectSnapshot(DictionaryState.items)).toEqual([]);
      listRequest().flush({ items: [], total: 0, page: 1, pageSize: 2 });
    });

    it('keeps the viewed status when the stats arrive after it', () => {
      store.dispatch(new OpenWord(phone));
      http
        .expectOne('/api/my-dictionary/12/view')
        .flush({ ...phone, status: WordStatus.LEARNING });
      http.expectOne('/api/my-dictionary/12').flush(phoneDetails); // still says UNKNOWN
      http.expectOne('/api/definitions/phone').flush(phoneDefinition);

      expect(store.selectSnapshot(DictionaryState.wordDetails)?.status).toBe(
        WordStatus.LEARNING,
      );
    });

    it('does not mark known or learning words as viewed', () => {
      store.dispatch(new OpenWord({ ...phone, status: WordStatus.KNOWN }));
      http.expectOne('/api/my-dictionary/12').flush(phoneDetails);
      http.expectOne('/api/definitions/phone').flush(phoneDefinition);
      http.expectNone('/api/my-dictionary/12/view');
    });

    it('shows a word WordNet does not know, keeping the stats', () => {
      store.dispatch(new OpenWord({ ...phone, status: WordStatus.LEARNING }));
      http.expectOne('/api/my-dictionary/12').flush(phoneDetails);
      http
        .expectOne('/api/definitions/phone')
        .flush(
          { message: 'No definition found for "phone"' },
          { status: 404, statusText: 'Not Found' },
        );

      expect(store.selectSnapshot(DictionaryState.definitionError)).toBe(
        'No definition found for "phone"',
      );
      expect(store.selectSnapshot(DictionaryState.definitionLoading)).toBe(
        false,
      );
      expect(store.selectSnapshot(DictionaryState.wordDetails)?.count).toBe(42);
    });

    it('ignores stats for a word that is no longer open', () => {
      store.dispatch(new OpenWord({ ...phone, status: WordStatus.KNOWN }));
      const details = http.expectOne('/api/my-dictionary/12');
      http.expectOne('/api/definitions/phone').flush(phoneDefinition);
      store.dispatch(new CloseWord());
      details.flush(phoneDetails);

      expect(store.selectSnapshot(DictionaryState.wordDetails)).toBeNull();
    });
  });

  it('forgets everything on sign-out', () => {
    loadKnown();
    store.dispatch(new SignOut());
    expect(store.selectSnapshot(DictionaryState.items)).toEqual([]);
    expect(store.selectSnapshot(DictionaryState.total)).toBe(0);
  });
});
