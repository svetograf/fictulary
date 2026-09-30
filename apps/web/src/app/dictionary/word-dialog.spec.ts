import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import {
  LoadDefinitionFail,
  LoadDefinitionSuccess,
  LoadWordDetailsSuccess,
  MarkWordViewedSuccess,
} from './dictionary.actions';
import { DictionaryService } from './dictionary.service';
import { DictionaryState } from './dictionary.state';
import { WordDialog } from './word-dialog';
import { phone, phoneDefinition, phoneDetails } from './testing';

describe('WordDialog', () => {
  const dictionary = {
    changeStatus: vi.fn(),
    retryDefinition: vi.fn(),
    retryDetails: vi.fn(),
  };
  const dialogRef = { close: vi.fn() };
  let store: Store;

  const render = async () => {
    const fixture = TestBed.createComponent(WordDialog);
    await fixture.whenStable();
    return fixture;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // The real state, without HTTP: responses are dispatched directly.
        provideStore([DictionaryState]),
        { provide: DictionaryService, useValue: dictionary },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    store = TestBed.inject(Store);
    // OpenWord would call the API; set the open word by hand instead.
    store.reset({
      ...store.snapshot(),
      dictionary: {
        ...store.snapshot().dictionary,
        word: { current: phone, details: null, loading: true, error: null },
        definition: { value: null, loading: true, error: null },
      },
    });
  });

  it('shows the article by part of speech, with WordNet attribution', async () => {
    const fixture = await render();
    store.dispatch(new LoadDefinitionSuccess(phoneDefinition));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const meanings = [...element.querySelectorAll('.meaning')];
    expect(
      meanings.map((m) => m.querySelector('h4')?.textContent?.trim()),
    ).toEqual(['noun', 'verb']);
    // Every example of a sense is shown.
    expect(
      [...meanings[1].querySelectorAll('q')].map((q) => q.textContent),
    ).toEqual([
      'I tried to call you all night',
      'Take two aspirin and call me in the morning',
    ]);
    expect(meanings[0].querySelector('.synonyms')?.textContent?.trim()).toBe(
      'Synonyms: telephone, telephone set',
    );
    const links = [...element.querySelectorAll('.attribution a')];
    expect(
      links.map((a) => [a.textContent?.trim(), a.getAttribute('href')]),
    ).toEqual([
      ['WordNet 3.1, Princeton University', 'https://wordnet.princeton.edu/'],
      [
        'WordNet License',
        'https://wordnet.princeton.edu/license-and-commercial-use',
      ],
    ]);
  });

  it('shows usage per book, linking to each book', async () => {
    const fixture = await render();
    store.dispatch(new LoadWordDetailsSuccess(phoneDetails));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(
      element
        .querySelector('.usage .total')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Used 42 times in 2 books.');
    const links = [...element.querySelectorAll('.usage a')];
    expect(
      links.map((a) => [a.textContent?.trim(), a.getAttribute('href')]),
    ).toEqual([
      ['Tale', '/book/3'],
      ['Notes', '/book/4'],
    ]);
  });

  it('reflects the status change from viewing an unknown word', async () => {
    const fixture = await render();
    const status = () =>
      (fixture.nativeElement as HTMLElement)
        .querySelector('.status')
        ?.textContent?.trim();
    expect(status()).toBe('help_outline Unknown');

    store.dispatch(
      new MarkWordViewedSuccess({ ...phone, status: WordStatus.LEARNING }),
    );
    await fixture.whenStable();
    expect(status()).toBe('school Learning');
  });

  const actionButtons = (fixture: { nativeElement: HTMLElement }) =>
    [
      ...fixture.nativeElement.querySelectorAll('mat-dialog-actions button'),
    ].map((button) => button as HTMLButtonElement);

  it('offers the other statuses and "Got it"', async () => {
    const fixture = await render();
    expect(
      actionButtons(fixture).map((b) =>
        b.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['task_alt Mark known', 'school Mark learning', 'check Got it']);
  });

  it.each([
    ['Mark known', WordStatus.KNOWN],
    ['Mark learning', WordStatus.LEARNING],
  ])('"%s" changes the status and closes the dialog', async (label, status) => {
    const fixture = await render();
    actionButtons(fixture)
      .find((b) => b.textContent?.includes(label))
      ?.click();

    expect(dictionary.changeStatus).toHaveBeenCalledWith('12', status);
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('"Mark unknown" changes the status and closes the dialog', async () => {
    store.reset({
      ...store.snapshot(),
      dictionary: {
        ...store.snapshot().dictionary,
        word: {
          current: { ...phone, status: WordStatus.LEARNING },
          details: null,
          loading: false,
          error: null,
        },
      },
    });
    const fixture = await render();
    actionButtons(fixture)
      .find((b) => b.textContent?.includes('Mark unknown'))
      ?.click();

    expect(dictionary.changeStatus).toHaveBeenCalledWith(
      '12',
      WordStatus.UNKNOWN,
    );
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('shows a failed lookup with a way to retry', async () => {
    const fixture = await render();
    store.dispatch(
      new LoadDefinitionFail('Could not reach the server. Please try again.'),
    );
    await fixture.whenStable();

    const alert = (fixture.nativeElement as HTMLElement).querySelector(
      '[role=alert]',
    );
    expect(alert?.textContent).toContain('Could not reach the server');
    (alert?.querySelector('button') as HTMLButtonElement).click();
    expect(dictionary.retryDefinition).toHaveBeenCalledWith('phone');
  });
});
