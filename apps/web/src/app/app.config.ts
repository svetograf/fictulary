import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';
import { Store, provideStore, withNgxsDevelopmentOptions } from '@ngxs/store';
import { appRoutes } from './app.routes';
import { RestoreSession } from './auth/auth.actions';
import { authInterceptor } from './auth/auth.interceptor';
import { AuthState } from './auth/auth.state';
import { BooksState } from './books/books.state';
import { DictionaryState } from './dictionary/dictionary.state';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideStore(
      [AuthState, BooksState, DictionaryState],
      withNgxsDevelopmentOptions({
        warnOnUnhandledActions: true,
      }),
      withNgxsReduxDevtoolsPlugin({ disabled: !isDevMode() }),
    ),
    // Runs before the first navigation, so route guards see a saved session.
    provideAppInitializer(() => inject(Store).dispatch(new RestoreSession())),
  ],
};
