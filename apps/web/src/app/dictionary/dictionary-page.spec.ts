import { TestBed } from '@angular/core/testing';
import { ModalController, ToastController } from '@ionic/angular';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CefrLevel, WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { LoadDictionarySuccess } from './dictionary.actions';
import { DictionaryPage } from './dictionary-page';
import { DictionaryService } from './dictionary.service';
import { DictionaryState } from './dictionary.state';
import { ariaLabel, text } from '../shared/ionic-testing';
import { phone, word } from './testing';

describe('DictionaryPage', () => {
  const dictionary = {
    load: vi.fn(),
    changeStatus: vi.fn(),
    openWord: vi.fn(),
    closeWord: vi.fn(),
  };
  /** Word dialogs close at once. */
  const modals = {
    create: vi.fn(async () => ({
      present: async () => undefined,
      onDidDismiss: async () => ({}),
    })),
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve));
  const actionButtons = () => [
    ...element().querySelectorAll<HTMLIonButtonElement>(
      '.words li .actions ion-button',
    ),
  ];
  let harness: RouterTestingHarness;

  const element = () => harness.routeNativeElement as HTMLElement;
  const show = async (items = [word('1'), word('2')], total = 2) => {
    TestBed.inject(Store).dispatch(
      new LoadDictionarySuccess({ items, total, page: 1, pageSize: 50 }),
    );
    await harness.fixture.whenStable();
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'my-dictionary', component: DictionaryPage }],
          withComponentInputBinding(),
        ),
        provideStore([DictionaryState]),
        { provide: DictionaryService, useValue: dictionary },
        { provide: ModalController, useValue: modals },
        { provide: ToastController, useValue: { create: vi.fn() } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  it('shows known words by default', async () => {
    await harness.navigateByUrl('/my-dictionary', DictionaryPage);
    expect(dictionary.load).toHaveBeenCalledWith({
      status: WordStatus.KNOWN,
      page: 1,
      pageSize: 50,
      bookWordsOnly: true,
    });
  });

  it('reloads when shown again from the navigation stack', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=LEARNING',
      DictionaryPage,
    );
    const page = harness.routeDebugElement?.componentInstance as DictionaryPage;
    page.ionViewWillEnter(); // the first visit, already loaded
    expect(dictionary.load).toHaveBeenCalledTimes(1);

    page.ionViewWillEnter();
    expect(dictionary.load).toHaveBeenCalledTimes(2);
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status: WordStatus.LEARNING,
      page: 1,
      pageSize: 50,
      bookWordsOnly: true,
    });
  });

  it('reads the filter and page from the URL, ignoring invalid values', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=LEARNING&page=3&pageSize=25',
      DictionaryPage,
    );
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status: WordStatus.LEARNING,
      page: 3,
      pageSize: 25,
      bookWordsOnly: true,
    });

    await harness.navigateByUrl(
      '/my-dictionary?status=NOPE&page=-2&pageSize=7',
      DictionaryPage,
    );
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status: WordStatus.KNOWN,
      page: 1,
      pageSize: 50,
      bookWordsOnly: true,
    });
  });

  it('switches status through the header filter', async () => {
    await harness.navigateByUrl('/my-dictionary?page=4', DictionaryPage);
    const toggles = element().querySelectorAll<HTMLElement>(
      '.filter ion-segment-button',
    );
    // Named for screen readers even when narrow screens hide the labels.
    expect([...toggles].map((t) => ariaLabel(t))).toEqual([
      'Known',
      'Learning',
      'Unknown',
      'Name',
      'Trash',
    ]);
    expect(
      [...toggles].map(
        (t) => t.querySelector<HTMLIonIconElement>('ion-icon')?.name,
      ),
    ).toEqual([
      'checkmark-circle-outline',
      'school-outline',
      'help-circle-outline',
      'person-circle-outline',
      'trash-outline',
    ]);

    toggles[2].click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/my-dictionary?status=UNKNOWN');
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status: WordStatus.UNKNOWN,
      page: 1,
      pageSize: 50,
      bookWordsOnly: true,
    });
  });

  it('shows book words only by default, toggled off through the URL', async () => {
    await harness.navigateByUrl('/my-dictionary?page=3', DictionaryPage);
    const toggle = element().querySelector<HTMLIonToggleElement>(
      '.title-row ion-toggle',
    );
    expect(text(toggle)).toBe('Book words only');
    expect(toggle?.checked).toBe(true);

    toggle?.dispatchEvent(
      new CustomEvent('ionChange', { detail: { checked: false } }),
    );
    await harness.fixture.whenStable();

    // Back to page 1 of the longer list.
    expect(TestBed.inject(Router).url).toBe(
      '/my-dictionary?bookWordsOnly=false',
    );
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status: WordStatus.KNOWN,
      page: 1,
      pageSize: 50,
      bookWordsOnly: false,
    });
    expect(toggle?.checked).toBe(false);

    toggle?.dispatchEvent(
      new CustomEvent('ionChange', { detail: { checked: true } }),
    );
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/my-dictionary');
  });

  it('lists words with usage and buttons for the two other statuses', async () => {
    await harness.navigateByUrl('/my-dictionary', DictionaryPage);
    await show();

    const rows = element().querySelectorAll('.words li');
    expect(rows).toHaveLength(2);
    expect(text(rows[0].querySelector('.usage'))).toBe('10 uses · 1 book');
    const buttons = [
      ...rows[0].querySelectorAll<HTMLIonButtonElement>('.actions ion-button'),
    ];
    expect(buttons.map((b) => text(b))).toEqual(['Learn', 'Unknown']);
    // The accessible name starts with the visible label.
    expect(buttons.map((b) => ariaLabel(b))).toEqual([
      'Learn: word1',
      'Unknown: word1',
    ]);
    // "Learn" is the filled accent button; the others are outlined.
    expect(buttons.map((b) => [b.fill, b.color])).toEqual([
      ['solid', 'tertiary'],
      ['outline', 'primary'],
    ]);

    buttons[0].click();
    expect(dictionary.changeStatus).toHaveBeenCalledWith(
      '1',
      WordStatus.LEARNING,
    );
  });

  it('capitalizes names', async () => {
    await harness.navigateByUrl('/my-dictionary?status=NAME', DictionaryPage);
    await show([word('1', WordStatus.NAME)]);
    expect(element().querySelector('.words .word')?.classList).toContain(
      'name',
    );
  });

  it('marks words from the level word list with their level', async () => {
    await harness.navigateByUrl('/my-dictionary', DictionaryPage);
    await show([
      { ...word('1'), count: 0, bookCount: 0, level: CefrLevel.A1 },
      word('2'),
    ]);

    const [fromList, other] = element().querySelectorAll('.words li');
    expect(fromList.querySelector('.word')?.classList).toContain('from-level');
    expect(text(fromList.querySelector('.usage'))).toBe('A1 0 uses · 0 books');
    expect(fromList.querySelector('.usage')?.firstElementChild?.className).toBe(
      'level',
    );
    expect(other.querySelector('.word')?.classList).not.toContain('from-level');
    expect(other.querySelector('.level')).toBeNull();
  });

  it('offers "I know" for words not known yet', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=LEARNING',
      DictionaryPage,
    );
    await show([word('1', WordStatus.LEARNING)], 1);

    expect(actionButtons().map((b) => text(b))).toEqual(['I know', 'Unknown']);
  });

  it('opens the word dialog', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=UNKNOWN',
      DictionaryPage,
    );
    await show([phone], 1);

    (element().querySelector('button.word') as HTMLButtonElement).click();

    expect(dictionary.openWord).toHaveBeenCalledWith(phone);
    expect(modals.create).toHaveBeenCalled();
    await settle();
    expect(dictionary.closeWord).toHaveBeenCalled(); // our fake closes at once
  });

  it('explains an empty status', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=LEARNING',
      DictionaryPage,
    );
    await show([], 0);
    expect(element().querySelector('.empty')?.textContent).toContain(
      'Nothing to learn yet',
    );
  });

  it.each([
    [WordStatus.NAME, 'No names yet'],
    [WordStatus.TRASH, 'Trash is empty'],
  ])('lists %s words', async (status, emptyText) => {
    await harness.navigateByUrl(
      `/my-dictionary?status=${status}`,
      DictionaryPage,
    );
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status,
      page: 1,
      pageSize: 50,
      bookWordsOnly: true,
    });

    await show([], 0);
    expect(element().querySelector('.empty')?.textContent).toContain(emptyText);
  });

  it('offers a single "Restore" for names, making them Unknown', async () => {
    await harness.navigateByUrl('/my-dictionary?status=NAME', DictionaryPage);
    await show([word('1', WordStatus.NAME)], 1);

    const buttons = actionButtons();
    expect(buttons.map((b) => text(b))).toEqual(['Restore']);
    expect(ariaLabel(buttons[0])).toBe('Restore: word1');

    buttons[0].click();
    expect(dictionary.changeStatus).toHaveBeenCalledWith(
      '1',
      WordStatus.UNKNOWN,
    );
  });

  it('offers only the learning statuses as quick buttons, even in Trash', async () => {
    await harness.navigateByUrl('/my-dictionary?status=TRASH', DictionaryPage);
    await show([word('1', WordStatus.TRASH)], 1);

    expect(actionButtons().map((b) => text(b))).toEqual([
      'I know',
      'Learn',
      'Unknown',
    ]);
  });
});
