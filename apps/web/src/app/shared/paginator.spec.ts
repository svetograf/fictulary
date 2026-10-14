import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageChange, Paginator } from './paginator';

@Component({
  imports: [Paginator],
  template: `
    <app-paginator
      [length]="length()"
      [page]="page()"
      [pageSize]="25"
      [pageSizes]="[25, 50, 100]"
      (pageChange)="changes.push($event)"
    />
  `,
})
class Host {
  readonly length = signal(120);
  readonly page = signal(1);
  readonly changes: PageChange[] = [];
}

describe('Paginator', () => {
  const render = async (page = 1, length = 120) => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.page.set(page);
    fixture.componentInstance.length.set(length);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return {
      host: fixture.componentInstance,
      element,
      range: () => element.querySelector('.range')?.textContent,
      button: (name: 'previous' | 'next') =>
        element.querySelector<HTMLIonButtonElement>(`ion-button.${name}`),
    };
  };

  it('shows the range of items on the page', async () => {
    expect((await render(1)).range()).toBe('1 – 25 of 120');
    TestBed.resetTestingModule();
    expect((await render(5)).range()).toBe('101 – 120 of 120');
    TestBed.resetTestingModule();
    expect((await render(1, 0)).range()).toBe('0 of 0');
  });

  it('pages back and forth, within the pages there are', async () => {
    const first = await render(1);
    expect(first.button('previous')?.disabled).toBe(true);
    first.button('next')?.click();
    expect(first.host.changes).toEqual([{ page: 2, pageSize: 25 }]);

    TestBed.resetTestingModule();
    const last = await render(5);
    expect(last.button('next')?.disabled).toBe(true);
    last.button('previous')?.click();
    expect(last.host.changes).toEqual([{ page: 4, pageSize: 25 }]);
  });

  it('keeps the first item in view when the page size changes', async () => {
    const { element, host } = await render(3); // items 51–75
    element
      .querySelector('ion-select')
      ?.dispatchEvent(new CustomEvent('ionChange', { detail: { value: 50 } }));
    expect(host.changes).toEqual([{ page: 2, pageSize: 50 }]); // 51–100
  });
});
