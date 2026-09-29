import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Books',
    loadComponent: () =>
      import('./books/book-list-page').then((m) => m.BookListPage),
  },
  {
    path: 'book/:id',
    title: 'Book',
    loadComponent: () => import('./books/book-page').then((m) => m.BookPage),
  },
  {
    path: 'upload',
    title: 'Upload a book',
    loadComponent: () =>
      import('./books/upload-page').then((m) => m.UploadPage),
  },
  { path: '**', redirectTo: '' },
];
