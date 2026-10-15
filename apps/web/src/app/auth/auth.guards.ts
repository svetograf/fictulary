import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { AuthState } from './auth.state';

/**
 * Pages for signed-in users. Others go to the landing page, which opens
 * sign-in and comes back here after.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const signedIn = inject(Store).selectSnapshot(AuthState.isAuthenticated);
  return (
    signedIn ||
    inject(Router).createUrlTree(['/'], {
      queryParams: { returnUrl: state.url },
    })
  );
};

/**
 * Only same-app paths are allowed as a post-sign-in destination, so a
 * crafted `returnUrl` can't send the user to another site.
 */
export function safeReturnUrl(url: string | null | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}
