import {
  Component,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Actions, ofActionDispatched, select } from '@ngxs/store';
import { UploadFileSuccess } from './books.actions';
import { BooksService } from './books.service';
import { BooksState } from './books.state';
import { NamesReview } from './names-review';
import { UploadForm } from './upload-form';

enum Step {
  Upload,
  ReviewNames,
  Book,
}

/**
 * The upload wizard: 1. upload the book, 2. review the names found in it,
 * 3. a pointer to the book page, where its words to learn are.
 */
@Component({
  selector: 'app-upload-page',
  imports: [
    IonContent,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatStepperModule,
    NamesReview,
    UploadForm,
  ],
  templateUrl: './upload-page.html',
  styleUrl: './upload-page.scss',
  // Pages in ion-router-outlet need this class for layout and transitions.
  host: { class: 'ion-page' },
})
export class UploadPage {
  private readonly books = inject(BooksService);
  private readonly injector = inject(Injector);
  private readonly content = viewChild.required(IonContent);
  private readonly stepper = viewChild.required(MatStepper);

  protected readonly uploaded = select(BooksState.uploadedBook);
  /** Names were reviewed; the last step can be shown. */
  protected readonly reviewed = signal(false);

  constructor() {
    // Each visit starts a new upload.
    this.books.reset();

    // React to the upload finishing, not to the uploaded book changing: its
    // words change whenever a word's status does (e.g. viewing one on the
    // Book step), which must not send the user back to the review.
    inject(Actions)
      .pipe(ofActionDispatched(UploadFileSuccess), takeUntilDestroyed())
      .subscribe(({ book }: UploadFileSuccess) => {
        this.books.loadBookNames(book.id);
        this.goTo(Step.ReviewNames);
      });
  }

  protected showBook(): void {
    this.reviewed.set(true);
    this.goTo(Step.Book);
  }

  /**
   * Moves after the next render: the linear stepper only allows a step once
   * the previous one shows as completed, which bindings update on render.
   */
  private goTo(step: Step): void {
    afterNextRender(
      () => {
        this.stepper().selectedIndex = step;
        // The previous step may have been scrolled (e.g. a long form).
        this.content().scrollToTop();
      },
      { injector: this.injector },
    );
  }
}
