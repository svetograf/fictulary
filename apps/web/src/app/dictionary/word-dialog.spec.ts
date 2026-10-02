import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { NameKind, WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import {
  LoadDefinitionFail,
  LoadDefinitionSuccess,
  LoadWordDetailsSuccess,
  MarkWordViewedSuccess,
  WordRef,
} from './dictionary.actions';
import { DictionaryService } from './dictionary.service';
import { DictionaryState } from './dictionary.state';
import { WordDialog, WordDialogData } from './word-dialog';
import { phone, phoneDefinition, phoneDetails, word } from './testing';

describe('WordDialog', () => {
  let store: Store;
  /** The list the dialog was opened from: phone, then word1, word2. */
  const list = signal<WordRef[]>([]);
  const setOpenWord = (current: WordRef) =>
    store.reset({
      ...store.snapshot(),
      dictionary: {
        ...store.snapshot().dictionary,
        word: { current, details: null, loading: true, error: null },
        definition: { value: null, loading: true, error: null },
      },
    });
  const dictionary = {
    changeStatus: vi.fn(),
    retryDefinition: vi.fn(),
    retryDetails: vi.fn(),
    // OpenWord would call the API; just switch the open word.
    openWord: vi.fn((next: WordRef) => setOpenWord(next)),
  };
  const dialogRef = { close: vi.fn() };

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
        {
          provide: MAT_DIALOG_DATA,
          useValue: { word: phone, list } satisfies WordDialogData,
        },
      ],
    });
    store = TestBed.inject(Store);
    list.set([phone, word('1'), word('2')]);
    setOpenWord(phone);
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

  describe('name hint', () => {
    const hint = async (nameKinds: NameKind[], status = WordStatus.UNKNOWN) => {
      setOpenWord({ ...phone, status });
      const fixture = await render();
      store.dispatch(
        new LoadWordDetailsSuccess({ ...phoneDetails, status, nameKinds }),
      );
      await fixture.whenStable();
      return (fixture.nativeElement as HTMLElement)
        .querySelector('.name-hint')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();
    };

    it('says what the word probably names', async () => {
      expect(await hint([NameKind.CITY])).toBe('badge Probably a name (city)');
    });

    it('lists every kind it was found as', async () => {
      expect(await hint([NameKind.PERSON, NameKind.CITY])).toBe(
        'badge Probably a name (person, city)',
      );
    });

    it('is not shown for words outside the names list', async () => {
      expect(await hint([])).toBeUndefined();
    });

    it('is shown for Name words too, e.g. when browsing the Name list', async () => {
      expect(await hint([NameKind.PERSON], WordStatus.NAME)).toBe(
        'badge Probably a name (person)',
      );
    });
  });

  it('reflects the status change from viewing an unknown word', async () => {
    const fixture = await render();
    const status = () =>
      (fixture.nativeElement as HTMLElement)
        .querySelector('.status')
        ?.textContent?.trim();
    expect(status()).toBe('help_outline Unknown arrow_drop_down');

    store.dispatch(
      new MarkWordViewedSuccess({ ...phone, status: WordStatus.LEARNING }),
    );
    await fixture.whenStable();
    expect(status()).toBe('school Learning arrow_drop_down');
  });

  it('has only "Next" at the bottom', async () => {
    const fixture = await render();
    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        'mat-dialog-actions button',
      ),
    ];
    expect(
      buttons.map((b) => b.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['Next arrow_forward']);
  });

  it('closes from the X button in the corner', async () => {
    const fixture = await render();
    const close = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('.header button[aria-label="Close"]');
    close?.click();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  describe('"Next"', () => {
    const nextButton = (fixture: { nativeElement: HTMLElement }) =>
      fixture.nativeElement.querySelector<HTMLButtonElement>('button.next');
    const title = (fixture: { nativeElement: HTMLElement }) =>
      fixture.nativeElement.querySelector('.title .word')?.textContent?.trim();

    it('opens the next word in the list and stays open', async () => {
      const fixture = await render();
      nextButton(fixture)?.click();
      await fixture.whenStable();

      expect(dictionary.openWord).toHaveBeenLastCalledWith(word('1'));
      expect(title(fixture)).toBe('word1');
      expect(dialogRef.close).not.toHaveBeenCalled();

      nextButton(fixture)?.click();
      await fixture.whenStable();
      expect(title(fixture)).toBe('word2');
    });

    it('is disabled on the last word', async () => {
      const fixture = await render();
      nextButton(fixture)?.click();
      await fixture.whenStable();
      nextButton(fixture)?.click();
      await fixture.whenStable();

      expect(title(fixture)).toBe('word2');
      expect(nextButton(fixture)?.disabled).toBe(true);
    });

    it('still finds the next word when viewing moved this one out of the list', async () => {
      const fixture = await render();
      // On the Unknown filter, viewing makes the word Learning and the list
      // drops it: its successor moves up into its place.
      list.set([word('1'), word('2')]);
      await fixture.whenStable();

      nextButton(fixture)?.click();
      expect(dictionary.openWord).toHaveBeenLastCalledWith(word('1'));
    });
  });

  describe('"I know!"', () => {
    const learningPhone = { ...phone, status: WordStatus.LEARNING };
    const buttons = (fixture: { nativeElement: HTMLElement }) =>
      [
        ...fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
          'mat-dialog-actions button',
        ),
      ].map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    const knowButton = (fixture: { nativeElement: HTMLElement }) =>
      fixture.nativeElement.querySelector<HTMLButtonElement>('button.know');

    it('appears left of "Next" for words being learned', async () => {
      list.set([learningPhone, word('1')]);
      setOpenWord(learningPhone);
      const fixture = await render();
      expect(buttons(fixture)).toEqual([
        'task_alt I know!',
        'Next arrow_forward',
      ]);
      expect(knowButton(fixture)?.classList).toContain(
        'mat-mdc-unelevated-button',
      );
    });

    it.each([WordStatus.UNKNOWN, WordStatus.KNOWN])(
      'is not shown for %s words',
      async (status) => {
        setOpenWord({ ...phone, status });
        const fixture = await render();
        expect(knowButton(fixture)).toBeNull();
      },
    );

    it('marks the word known and opens the next one', async () => {
      list.set([learningPhone, word('1')]);
      setOpenWord(learningPhone);
      const fixture = await render();

      knowButton(fixture)?.click();
      await fixture.whenStable();

      expect(dictionary.changeStatus).toHaveBeenCalledWith(
        '12',
        WordStatus.KNOWN,
      );
      expect(dictionary.openWord).toHaveBeenLastCalledWith(word('1'));
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('closes the dialog on the last word', async () => {
      list.set([word('1'), learningPhone]);
      setOpenWord(learningPhone);
      const fixture = await render();

      knowButton(fixture)?.click();

      expect(dictionary.changeStatus).toHaveBeenCalledWith(
        '12',
        WordStatus.KNOWN,
      );
      expect(dictionary.openWord).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalled();
    });

    it('is disabled while a change is in flight', async () => {
      setOpenWord(learningPhone);
      store.reset({
        ...store.snapshot(),
        dictionary: { ...store.snapshot().dictionary, pendingWordIds: ['12'] },
      });
      const fixture = await render();
      expect(knowButton(fixture)?.disabled).toBe(true);
    });
  });

  describe('status dropdown', () => {
    const badge = (fixture: { nativeElement: HTMLElement }) =>
      fixture.nativeElement.querySelector<HTMLButtonElement>(
        '.title button.status',
      );
    const openMenu = async (fixture: Awaited<ReturnType<typeof render>>) => {
      badge(fixture)?.click();
      await fixture.whenStable();
      // The menu renders in the overlay container, outside the dialog.
      return [
        ...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item'),
      ];
    };

    it('shows the status as a button that opens a menu', async () => {
      const fixture = await render();
      expect(badge(fixture)?.getAttribute('aria-label')).toBe(
        'Status: Unknown. Change status',
      );
      expect(badge(fixture)?.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('lists every status, marking the current one', async () => {
      const fixture = await render();
      const items = await openMenu(fixture);
      const describe = (item: HTMLElement) => ({
        icon: item.querySelector(':scope > mat-icon')?.textContent?.trim(),
        label: item
          .querySelector('.mat-mdc-menu-item-text')
          ?.textContent?.replace('check', '')
          .trim(),
        // The check sits after the label, not in the icon slot.
        checked: !!item.querySelector(
          '.mat-mdc-menu-item-text .selected mat-icon',
        ),
        current: item.getAttribute('aria-current'),
      });
      expect(items.map(describe)).toEqual([
        { icon: 'task_alt', label: 'Known', checked: false, current: null },
        { icon: 'school', label: 'Learning', checked: false, current: null },
        {
          icon: 'help_outline',
          label: 'Unknown',
          checked: true,
          current: 'true',
        },
        { icon: 'badge', label: 'Name', checked: false, current: null },
        { icon: 'delete', label: 'Trash', checked: false, current: null },
      ]);
    });

    it('changes the status and keeps the dialog open', async () => {
      const fixture = await render();
      const items = await openMenu(fixture);
      items[0].click();

      expect(dictionary.changeStatus).toHaveBeenCalledWith(
        '12',
        WordStatus.KNOWN,
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('separates Name and Trash from the learning statuses', async () => {
      const fixture = await render();
      await openMenu(fixture);
      const panel = document.querySelector('.mat-mdc-menu-content');
      const sequence = [...(panel?.children ?? [])].map((el) =>
        el.tagName === 'MAT-DIVIDER'
          ? '---'
          : el
              .querySelector('.mat-mdc-menu-item-text')
              ?.textContent?.replace('check', '')
              .trim(),
      );
      expect(sequence).toEqual([
        'Known',
        'Learning',
        'Unknown',
        '---',
        'Name',
        'Trash',
      ]);
    });

    it.each([WordStatus.NAME, WordStatus.TRASH])(
      'puts the word in %s',
      async (status) => {
        const fixture = await render();
        const items = await openMenu(fixture);
        items
          .find((i) =>
            i.textContent?.includes(
              status === WordStatus.NAME ? 'Name' : 'Trash',
            ),
          )
          ?.click();
        expect(dictionary.changeStatus).toHaveBeenCalledWith('12', status);
      },
    );

    it('does nothing when the current status is picked again', async () => {
      const fixture = await render();
      const items = await openMenu(fixture);
      items[2].click();
      expect(dictionary.changeStatus).not.toHaveBeenCalled();
    });

    it('is disabled while a change is in flight', async () => {
      store.reset({
        ...store.snapshot(),
        dictionary: { ...store.snapshot().dictionary, pendingWordIds: ['12'] },
      });
      const fixture = await render();
      expect(badge(fixture)?.disabled).toBe(true);
    });
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
