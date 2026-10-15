import { Route } from '@angular/router';
import { authGuard, guestGuard } from './auth/auth.guards';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Books',
    loadComponent: () =>
      import('./books/book-list-page').then((m) => m.BookListPage),
  },
  {
    path: 'sign-in',
    title: 'Sign in',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./auth/sign-in-page').then((m) => m.SignInPage),
  },
  {
    path: 'auth/callback',
    title: 'Signing in',
    loadComponent: () =>
      import('./auth/auth-callback-page').then((m) => m.AuthCallbackPage),
  },
  {
    path: 'welcome',
    title: 'Welcome',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/welcome-page').then((m) => m.WelcomePage),
  },
  {
    path: 'account',
    title: 'Account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/account-page').then((m) => m.AccountPage),
  },
  {
    path: 'book/:id',
    title: 'Book',
    canActivate: [authGuard],
    loadComponent: () => import('./books/book-page').then((m) => m.BookPage),
  },
  {
    path: 'my-dictionary',
    title: 'My dictionary',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dictionary/dictionary-page').then((m) => m.DictionaryPage),
  },
  {
    path: 'upload',
    title: 'Upload a book',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./books/upload-page').then((m) => m.UploadPage),
  },
  { path: '**', redirectTo: '' },
];
