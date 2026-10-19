import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
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
import { ariaLabel, text } from '../shared/ionic-testing';
import { WORD_DIALOG_DATA, WordDialog, WordDialogData } from './word-dialog';
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
  const modal = { dismiss: vi.fn() };

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
        { provide: ModalController, useValue: modal },
        {
          provide: WORD_DIALOG_DATA,
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
      return text(
        (fixture.nativeElement as HTMLElement).querySelector('.name-hint'),
      );
    };

    it('says what the word probably names', async () => {
      expect(await hint([NameKind.CITY])).toBe('Probably a name (city)');
    });

    it('lists every kind it was found as', async () => {
      expect(await hint([NameKind.PERSON, NameKind.CITY])).toBe(
        'Probably a name (person, city)',
      );
    });

    it('is not shown for words outside the names list', async () => {
      expect(await hint([])).toBeUndefined();
    });

    it('is shown for Name words too, e.g. when browsing the Name list', async () => {
      expect(await hint([NameKind.PERSON], WordStatus.NAME)).toBe(
        'Probably a name (person)',
      );
    });
  });

  it('reflects the status change from viewing an unknown word', async () => {
    const fixture = await render();
    const status = () =>
      text((fixture.nativeElement as HTMLElement).querySelector('.status'));
    expect(status()).toBe('Unknown');

    store.dispatch(
      new MarkWordViewedSuccess({ ...phone, status: WordStatus.LEARNING }),
    );
    await fixture.whenStable();
    expect(status()).toBe('Learning');
  });

  it('capitalizes the word while it is a name', async () => {
    const fixture = await render();
    const title = () =>
      (fixture.nativeElement as HTMLElement).querySelector('.title .word');
    expect(title()?.classList).not.toContain('name');

    store.dispatch(
      new MarkWordViewedSuccess({ ...phone, status: WordStatus.NAME }),
    );
    await fixture.whenStable();
    expect(title()?.classList).toContain('name');
  });

  it('has only "Next" at the bottom', async () => {
    const fixture = await render();
    const buttons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        'ion-footer ion-button',
      ),
    ];
    expect(buttons.map((b) => text(b))).toEqual(['Next']);
  });

  it('closes from the X button in the corner', async () => {
    const fixture = await render();
    const close = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.header ion-button.close');
    expect(ariaLabel(close)).toBe('Close');
    close?.click();
    expect(modal.dismiss).toHaveBeenCalled();
  });

  describe('"Next"', () => {
    const nextButton = (fixture: { nativeElement: HTMLElement }) =>
      fixture.nativeElement.querySelector<HTMLIonButtonElement>(
        'ion-button.next',
      );
    const title = (fixture: { nativeElement: HTMLElement }) =>
      fixture.nativeElement.querySelector('.title .word')?.textContent?.trim();

    it('opens the next word in the list and stays open', async () => {
      const fixture = await render();
      nextButton(fixture)?.click();
      await fixture.whenStable();

      expect(dictionary.openWord).toHaveBeenLastCalledWith(word('1'));
      expect(title(fixture)).toBe('word1');
      expect(modal.dismiss).not.toHaveBeenCalled();

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
      [...fixture.nativeElement.querySelectorAll('ion-footer ion-button')].map(
        (b) => text(b),
      );
    const knowButton = (fixture: { nativeElement: HTMLElement }) =>
      fixture.nativeElement.querySelector<HTMLIonButtonElement>(
        'ion-button.know',
      );

    it('appears left of "Next" for words being learned', async () => {
      list.set([learningPhone, word('1')]);
      setOpenWord(learningPhone);
      const fixture = await render();
      expect(buttons(fixture)).toEqual(['I know!', 'Next']);
      expect(knowButton(fixture)?.fill).toBe('solid');
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
      expect(modal.dismiss).not.toHaveBeenCalled();
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
      expect(modal.dismiss).toHaveBeenCalled();
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
    // The popover keeps its items in the page, ready to show.
    const menuItems = (fixture: { nativeElement: HTMLElement }) => [
      ...fixture.nativeElement.querySelectorAll<HTMLElement>(
        'ion-popover .status-menu ion-item',
      ),
    ];

    it('shows the status as a button that opens a menu', async () => {
      const fixture = await render();
      expect(badge(fixture)?.getAttribute('aria-label')).toBe(
        'Status: Unknown. Change status',
      );
      expect(badge(fixture)?.getAttribute('aria-haspopup')).toBe('true');
      const popover = (fixture.nativeElement as HTMLElement).querySelector(
        'ion-popover',
      ) as HTMLIonPopoverElement | null;
      expect(popover?.trigger).toBe(badge(fixture)?.id);
    });

    it('lists every status, marking the current one', async () => {
      const fixture = await render();
      const describe = (item: HTMLElement) => ({
        icon: item.querySelector<HTMLIonIconElement>('ion-icon[slot=start]')
          ?.name,
        label: text(item.querySelector('ion-label')),
        // The check sits after the label, not in the icon slot.
        checked: !!item.querySelector('ion-icon[slot=end].selected'),
        current: item.getAttribute('aria-current'),
      });
      expect(menuItems(fixture).map(describe)).toEqual([
        {
          icon: 'checkmark-circle-outline',
          label: 'Known',
          checked: false,
          current: null,
        },
        {
          icon: 'school-outline',
          label: 'Learning',
          checked: false,
          current: null,
        },
        {
          icon: 'help-circle-outline',
          label: 'Unknown',
          checked: true,
          current: 'true',
        },
        {
          icon: 'person-circle-outline',
          label: 'Name',
          checked: false,
          current: null,
        },
        {
          icon: 'trash-outline',
          label: 'Trash',
          checked: false,
          current: null,
        },
      ]);
    });

    it('changes the status and keeps the dialog open', async () => {
      const fixture = await render();
      menuItems(fixture)[0].click();

      expect(dictionary.changeStatus).toHaveBeenCalledWith(
        '12',
        WordStatus.KNOWN,
      );
      expect(modal.dismiss).not.toHaveBeenCalled();
    });

    it('separates Name and Trash from the learning statuses', async () => {
      const fixture = await render();
      // A rule above the first set-aside status.
      const sequence = menuItems(fixture).flatMap((item) => [
        ...(item.classList.contains('set-aside') ? ['---'] : []),
        text(item.querySelector('ion-label')),
      ]);
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
        menuItems(fixture)
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
      menuItems(fixture)[2].click();
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
    alert?.querySelector<HTMLElement>('ion-button')?.click();
    expect(dictionary.retryDefinition).toHaveBeenCalledWith('phone');
  });
});
