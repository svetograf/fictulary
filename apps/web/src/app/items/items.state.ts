import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { EMPTY, Observable, catchError, finalize, tap } from 'rxjs';
import { AddItem, LoadItems, RemoveItem } from './items.actions';
import { Item } from './item.model';
import { ItemsService } from './items.service';

export interface ItemsStateModel {
  items: Item[];
  loading: boolean;
  error: string | null;
}

@State<ItemsStateModel>({
  name: 'items',
  defaults: { items: [], loading: false, error: null },
})
@Injectable()
export class ItemsState {
  private readonly itemsService = inject(ItemsService);

  @Selector()
  static items(state: ItemsStateModel): Item[] {
    return state.items;
  }

  @Selector()
  static loading(state: ItemsStateModel): boolean {
    return state.loading;
  }

  @Selector()
  static error(state: ItemsStateModel): string | null {
    return state.error;
  }

  @Action(LoadItems)
  load(ctx: StateContext<ItemsStateModel>) {
    return this.withRequest(ctx, this.itemsService.getAll()).pipe(
      tap((items) => ctx.patchState({ items })),
    );
  }

  @Action(AddItem)
  add(ctx: StateContext<ItemsStateModel>, { item }: AddItem) {
    return this.withRequest(ctx, this.itemsService.create(item)).pipe(
      tap((created) =>
        ctx.patchState({ items: [created, ...ctx.getState().items] }),
      ),
    );
  }

  @Action(RemoveItem)
  remove(ctx: StateContext<ItemsStateModel>, { id }: RemoveItem) {
    return this.withRequest(ctx, this.itemsService.remove(id)).pipe(
      tap(() =>
        ctx.patchState({
          items: ctx.getState().items.filter((item) => item.id !== id),
        }),
      ),
    );
  }

  private withRequest<T>(
    ctx: StateContext<ItemsStateModel>,
    request: Observable<T>,
  ): Observable<T> {
    ctx.patchState({ loading: true, error: null });
    return request.pipe(
      catchError((error: HttpErrorResponse) => {
        ctx.patchState({ error: error.message });
        return EMPTY;
      }),
      finalize(() => ctx.patchState({ loading: false })),
    );
  }
}
