import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { Store } from '@ngxs/store';
import { catchError, filter, take, throwError } from 'rxjs';
import { SignOut } from './auth.actions';
import { authGuard } from './auth.guards';
import { AuthState } from './auth.state';

/** Endpoints that must not carry a token (they issue one). */
const PUBLIC_AUTH_URLS = ['/api/sign-in', '/api/sign-up'];

/**
 * Signs API requests with the stored JWT. If the API rejects the token
 * (expired, revoked, account deleted), the user is signed out; on a
 * restricted page they're sent to sign in and brought back afterwards.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(Store);
  const router = inject(Router);
  const token = store.selectSnapshot(AuthState.token);

  if (
    !token ||
    !req.url.startsWith('/api/') ||
    PUBLIC_AUTH_URLS.includes(req.url)
  ) {
    return next(req);
  }

  const signed = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(signed).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        store.dispatch(new SignOut());
        leaveRestrictedPage(router);
      }
      return throwError(() => error);
    }),
  );
};

/**
 * Sends the user to sign in if they're on a page behind authGuard. When a
 * navigation is in progress (e.g. the profile request on app load), waits
 * for it to finish first, since `router.url` still shows the old page.
 */
function leaveRestrictedPage(router: Router): void {
  const redirect = () => {
    if (isRestricted(router.routerState.snapshot.root)) {
      router.navigate(['/sign-in'], {
        queryParams: { returnUrl: router.url },
      });
    }
  };

  if (!router.currentNavigation()) {
    redirect();
    return;
  }
  router.events
    .pipe(
      filter(
        (event) =>
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      take(1),
    )
    .subscribe(redirect);
}

function isRestricted(route: ActivatedRouteSnapshot): boolean {
  return (
    !!route.routeConfig?.canActivate?.includes(authGuard) ||
    route.children.some(isRestricted)
  );
}
