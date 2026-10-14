import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon, IonSelect, IonSelectOption } from '@ionic/angular';

/** A page the user asked for; pages count from 1. */
export interface PageChange {
  page: number;
  pageSize: number;
}

/** Previous/next page buttons and a page size choice for a long list. */
@Component({
  selector: 'app-paginator',
  imports: [IonButton, IonIcon, IonSelect, IonSelectOption],
  template: `
    <ion-select
      class="size"
      label="Items per page"
      interface="popover"
      [value]="pageSize()"
      (ionChange)="setPageSize($event.detail.value)"
    >
      @for (size of pageSizes(); track size) {
        <ion-select-option [value]="size">{{ size }}</ion-select-option>
      }
    </ion-select>
    <span class="range">{{ range() }}</span>
    <ion-button
      fill="clear"
      shape="round"
      class="previous"
      aria-label="Previous page"
      title="Previous page"
      [disabled]="page() <= 1"
      (click)="go(page() - 1)"
    >
      <ion-icon slot="icon-only" name="chevron-back" />
    </ion-button>
    <ion-button
      fill="clear"
      shape="round"
      class="next"
      aria-label="Next page"
      title="Next page"
      [disabled]="page() >= pageCount()"
      (click)="go(page() + 1)"
    >
      <ion-icon slot="icon-only" name="chevron-forward" />
    </ion-button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 4px 16px;
      font-size: 13px;
      color: var(--ion-color-medium);
    }

    .size {
      width: auto;
      min-height: 40px;
      font-size: 13px;
    }

    .range {
      white-space: nowrap;
    }

    ion-button {
      --color: var(--ion-text-color);
      margin: 0;
    }
  `,
})
export class Paginator {
  /** The number of items in all pages. */
  readonly length = input.required<number>();
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly pageSizes = input.required<readonly number[]>();

  readonly pageChange = output<PageChange>();

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.length() / this.pageSize())),
  );

  /** "26 – 50 of 120". */
  protected readonly range = computed(() => {
    const length = this.length();
    if (!length) {
      return '0 of 0';
    }
    const start = (this.page() - 1) * this.pageSize();
    const end = Math.min(start + this.pageSize(), length);
    return `${start + 1} – ${end} of ${length}`;
  });

  protected go(page: number): void {
    this.pageChange.emit({ page, pageSize: this.pageSize() });
  }

  /** Keeps the first item shown on the page with the new size. */
  protected setPageSize(pageSize: number): void {
    if (pageSize === this.pageSize()) {
      return;
    }
    const first = (this.page() - 1) * this.pageSize();
    this.pageChange.emit({ page: Math.floor(first / pageSize) + 1, pageSize });
  }
}
