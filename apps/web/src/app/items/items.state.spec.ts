import { TestBed } from '@angular/core/testing';
import { Store, provideStore } from '@ngxs/store';
import { of, throwError } from 'rxjs';
import { AddItem, LoadItems, RemoveItem } from './items.actions';
import { Item } from './item.model';
import { ItemsService } from './items.service';
import { ItemsState } from './items.state';

const item = (id: string): Item => ({
  id,
  name: `Item ${id}`,
  description: null,
  createdAt: '',
  updatedAt: '',
});

describe('ItemsState', () => {
  let store: Store;
  const service = {
    getAll: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideStore([ItemsState]),
        { provide: ItemsService, useValue: service },
      ],
    });
    store = TestBed.inject(Store);
  });

  it('loads items', () => {
    service.getAll.mockReturnValue(of([item('1'), item('2')]));
    store.dispatch(new LoadItems());
    expect(store.selectSnapshot(ItemsState.items)).toHaveLength(2);
    expect(store.selectSnapshot(ItemsState.loading)).toBe(false);
  });

  it('prepends added items and removes deleted ones', () => {
    service.getAll.mockReturnValue(of([item('1')]));
    service.create.mockReturnValue(of(item('2')));
    service.remove.mockReturnValue(of(undefined));

    store.dispatch(new LoadItems());
    store.dispatch(new AddItem({ name: 'Item 2' }));
    expect(store.selectSnapshot(ItemsState.items).map((i) => i.id)).toEqual([
      '2',
      '1',
    ]);

    store.dispatch(new RemoveItem('1'));
    expect(store.selectSnapshot(ItemsState.items).map((i) => i.id)).toEqual([
      '2',
    ]);
  });

  it('records request errors', () => {
    service.getAll.mockReturnValue(throwError(() => ({ message: 'boom' })));
    store.dispatch(new LoadItems());
    expect(store.selectSnapshot(ItemsState.error)).toBe('boom');
    expect(store.selectSnapshot(ItemsState.loading)).toBe(false);
  });
});
