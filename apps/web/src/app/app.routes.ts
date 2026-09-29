import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./items/items-page').then((m) => m.ItemsPage),
  },
  {
    path: 'upload',
    title: 'Upload a book',
    loadComponent: () =>
      import('./books/upload-page').then((m) => m.UploadPage),
  },
  { path: '**', redirectTo: '' },
];
