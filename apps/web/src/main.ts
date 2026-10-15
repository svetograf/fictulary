import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { registerIcons } from './app/shared/icons';

// In a sign-in popup, loading the social login plugin hands the result to
// the page that opened it and closes the popup. Not via the
// AUTH_CALLBACK_PATH constant, which would pull its module into this chunk.
if (window.location.pathname === '/auth/callback') {
  import('@capgo/capacitor-social-login');
}

registerIcons();
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
