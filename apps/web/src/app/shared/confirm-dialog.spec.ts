import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  const data: ConfirmDialogData = {
    title: 'Delete “Tale”?',
    message: 'This cannot be undone.',
    confirm: 'Delete',
  };
  const dialogRef = { close: vi.fn() };

  const render = async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialog);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };
  const buttons = (element: HTMLElement) => [
    ...element.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'),
  ];

  beforeEach(() => vi.clearAllMocks());

  it('shows the question and both choices', async () => {
    const element = await render();
    expect(element.querySelector('h2')?.textContent).toBe('Delete “Tale”?');
    expect(
      element.querySelector('mat-dialog-content')?.textContent?.trim(),
    ).toBe('This cannot be undone.');
    expect(buttons(element).map((b) => b.textContent?.trim())).toEqual([
      'Cancel',
      'Delete',
    ]);
  });

  it('starts focus on Cancel, so Enter does not confirm by accident', async () => {
    const element = await render();
    expect(buttons(element)[0].hasAttribute('cdkfocusinitial')).toBe(true);
    expect(buttons(element)[1].hasAttribute('cdkfocusinitial')).toBe(false);
  });

  it('closes with true on confirm and false on cancel', async () => {
    const element = await render();
    buttons(element)[1].click();
    expect(dialogRef.close).toHaveBeenLastCalledWith(true);
    buttons(element)[0].click();
    expect(dialogRef.close).toHaveBeenLastCalledWith(false);
  });
});
