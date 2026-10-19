import { Component, input, linkedSignal, output } from '@angular/core';
import { CefrLevel } from '@fictulary/shared/models';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
} from '@ionic/angular';

/** Word counts are the API's lists (CEFR-J, word forms grouped), rounded. */
export const LEVEL_OPTIONS: readonly {
  level: CefrLevel;
  title: string;
  hint: string;
}[] = [
  {
    level: CefrLevel.A1,
    title: 'A1 · Beginner',
    hint: 'Everyday basics like “house”, “eat” and “happy”: about 1,000 words.',
  },
  {
    level: CefrLevel.A2,
    title: 'A2 · Elementary',
    hint: 'Simple conversations and short texts: about 2,200 words.',
  },
  {
    level: CefrLevel.B1,
    title: 'B1 · Intermediate',
    hint: 'Familiar topics, simple novels: about 4,200 words.',
  },
  {
    level: CefrLevel.B2,
    title: 'B2 · Upper intermediate',
    hint: 'Most everyday and general texts: about 6,500 words.',
  },
];

/**
 * Picks a CEFR knowledge level; used on the welcome and account pages and
 * in the level dialog. Emits the chosen level, or null from the secondary
 * button (skip or remove) when `noneLabel` is given.
 */
@Component({
  selector: 'app-level-picker',
  imports: [IonButton, IonIcon, IonItem, IonRadio, IonRadioGroup, IonSpinner],
  template: `
    <ion-radio-group
      [value]="selected()"
      (ionChange)="selected.set($event.detail.value)"
    >
      @for (option of options; track option.level) {
        <ion-item lines="none" class="option">
          <ion-radio
            [value]="option.level"
            justify="start"
            labelPlacement="end"
            [disabled]="saving()"
          >
            <span class="title">{{ option.title }}</span>
            <span class="hint">{{ option.hint }}</span>
          </ion-radio>
        </ion-item>
      }
    </ion-radio-group>

    @if (error(); as message) {
      <p class="error" role="alert">
        <ion-icon name="alert-circle-outline" aria-hidden="true" />
        {{ message }}
      </p>
    }

    <div class="actions">
      <ion-button
        [disabled]="saving() || !selected() || selected() === level()"
        (click)="choose.emit(selected())"
      >
        {{ submitLabel() }}
      </ion-button>
      @if (noneLabel(); as label) {
        <ion-button
          fill="clear"
          color="medium"
          [disabled]="saving()"
          (click)="choose.emit(null)"
        >
          {{ label }}
        </ion-button>
      }
      @if (saving()) {
        <ion-spinner name="crescent" />
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    ion-radio-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .option {
      --background: var(--app-sunken);
      --border-radius: 8px;
      --padding-start: 12px;
      --inner-padding-end: 12px;
    }

    ion-radio::part(label) {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-inline-start: 12px;
      padding: 8px 0;
      white-space: normal;
    }

    .title {
      font-weight: 500;
    }

    .hint {
      color: var(--ion-color-medium);
      font-size: 14px;
    }

    .error {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: var(--ion-color-danger);

      ion-icon {
        flex: none;
        font-size: 20px;
      }
    }

    .actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 16px;

      ion-button {
        margin: 0;
      }
    }
  `,
})
export class LevelPicker {
  /** The user's current level, preselected; null for none. */
  readonly level = input<CefrLevel | null>(null);
  readonly submitLabel = input.required<string>();
  /** Label of the button that emits null; hidden when null. */
  readonly noneLabel = input<string | null>(null);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly choose = output<CefrLevel | null>();

  protected readonly options = LEVEL_OPTIONS;
  protected readonly selected = linkedSignal<CefrLevel | null>(() =>
    this.level(),
  );
}
