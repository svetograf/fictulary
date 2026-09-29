import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';
import { provideStore, withNgxsDevelopmentOptions } from '@ngxs/store';
import { appRoutes } from './app.routes';
import { BooksState } from './books/books.state';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    provideStore(
      [BooksState],
      withNgxsDevelopmentOptions({
        warnOnUnhandledActions: true,
      }),
      withNgxsReduxDevtoolsPlugin({ disabled: !isDevMode() }),
    ),
  ],
};
