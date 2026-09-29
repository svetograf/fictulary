import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./items/items-page').then((m) => m.ItemsPage),
  },
  { path: '**', redirectTo: '' },
];
