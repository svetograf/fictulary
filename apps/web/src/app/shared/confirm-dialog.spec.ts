import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogData, injectConfirm } from './confirm-dialog';

describe('injectConfirm', () => {
  const data: ConfirmDialogData = {
    title: 'Delete “Tale”?',
    message: 'This cannot be undone.',
    confirm: 'Delete',
  };
  let role: string | undefined;
  const alert = {
    present: vi.fn(async () => undefined),
    onDidDismiss: vi.fn(async () => ({ role })),
  };
  const alerts = { create: vi.fn(async () => alert) };

  const confirm = () => {
    TestBed.configureTestingModule({
      providers: [{ provide: AlertController, useValue: alerts }],
    });
    return TestBed.runInInjectionContext(() => injectConfirm())(data);
  };

  beforeEach(() => vi.clearAllMocks());

  it('asks the question with Cancel first, then the confirming button', async () => {
    role = 'cancel';
    await firstValueFrom(confirm());
    expect(alerts.create).toHaveBeenCalledWith({
      header: 'Delete “Tale”?',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        expect.objectContaining({ text: 'Delete', role: 'confirm' }),
      ],
    });
    expect(alert.present).toHaveBeenCalled();
  });

  it('emits true on confirm', async () => {
    role = 'confirm';
    expect(await firstValueFrom(confirm())).toBe(true);
  });

  it('emits false on cancel or when dismissed otherwise', async () => {
    role = 'cancel';
    expect(await firstValueFrom(confirm())).toBe(false);
    TestBed.resetTestingModule();
    role = 'backdrop';
    expect(await firstValueFrom(confirm())).toBe(false);
  });
});
