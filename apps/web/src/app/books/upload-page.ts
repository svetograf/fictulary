import { Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonRouterLink } from '@ionic/angular';
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
    IonButton,
    IonContent,
    IonIcon,
    IonRouterLink,
    RouterLink,
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
  private readonly content = viewChild.required(IonContent);

  protected readonly Step = Step;
  protected readonly stepLabels = ['Upload', 'Review names', 'Book'];
  protected readonly step = signal(Step.Upload);
  protected readonly uploaded = select(BooksState.uploadedBook);

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
    this.goTo(Step.Book);
  }

  /** The upload can't be redone; the names can be reviewed again. */
  protected canGoBackTo(step: Step): boolean {
    return step === Step.ReviewNames && this.step() === Step.Book;
  }

  protected goTo(step: Step): void {
    this.step.set(step);
    // The previous step may have been scrolled (e.g. a long form).
    this.content().scrollToTop();
  }
}
