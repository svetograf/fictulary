import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthResponse, User } from '@fictulary/shared/models';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { Observable, catchError, defer, mergeMap } from 'rxjs';
import { SetLevelSuccess } from '../books/books.actions';
import { httpErrorMessage } from '../shared/http-error-message';
import {
  ClearAuthError,
  DeleteAccount,
  DeleteAccountFail,
  DevSignIn,
  LoadMe,
  LoadMeFail,
  LoadMeSuccess,
  RestoreSession,
  SignInFail,
  SignInSuccess,
  SignInWithApple,
  SignInWithGoogle,
  SignOut,
  UpdateProfile,
  UpdateProfileFail,
  UpdateProfileSuccess,
} from './auth.actions';
import { isTokenExpired } from './jwt';
import {
  SignInCancelledError,
  SocialLoginService,
} from './social-login.service';
import { tokenStorage } from './token-storage';

export interface AuthStateModel {
  /** JWT for API requests; mirrored in localStorage. */
  token: string | null;
  user: User | null;
  /** A sign-in or profile update is in flight. */
  submitting: boolean;
  /** An account deletion is in flight. */
  deleting: boolean;
  error: string | null;
}

const defaults: AuthStateModel = {
  token: null,
  user: null,
  submitting: false,
  deleting: false,
  error: null,
};

type Ctx = StateContext<AuthStateModel>;

@State<AuthStateModel>({ name: 'auth', defaults })
@Injectable()
export class AuthState {
  private readonly http = inject(HttpClient);
  private readonly social = inject(SocialLoginService);

  @Selector()
  static token(state: AuthStateModel): string | null {
    return state.token;
  }

  @Selector()
  static isAuthenticated(state: AuthStateModel): boolean {
    return state.token !== null;
  }

  @Selector()
  static user(state: AuthStateModel): User | null {
    return state.user;
  }

  @Selector()
  static submitting(state: AuthStateModel): boolean {
    return state.submitting;
  }

  @Selector()
  static deleting(state: AuthStateModel): boolean {
    return state.deleting;
  }

  /** Signed in with a loaded profile that still has no name. */
  @Selector()
  static needsName(state: AuthStateModel): boolean {
    return state.user !== null && !state.user.name;
  }

  /** Signed in with a loaded profile that never answered the level prompt. */
  @Selector()
  static needsLevel(state: AuthStateModel): boolean {
    return state.user !== null && !state.user.levelPrompted;
  }

  /** Has steps of the welcome page left: a name or the knowledge level. */
  @Selector([AuthState.needsName, AuthState.needsLevel])
  static needsOnboarding(needsName: boolean, needsLevel: boolean): boolean {
    return needsName || needsLevel;
  }

  @Selector()
  static error(state: AuthStateModel): string | null {
    return state.error;
  }

  @Action(SignInWithGoogle, { cancelUncompleted: true })
  signInWithGoogle(ctx: Ctx) {
    return this.signIn(ctx, '/api/auth/google', () => this.social.google());
  }

  @Action(SignInWithApple, { cancelUncompleted: true })
  signInWithApple(ctx: Ctx) {
    return this.signIn(ctx, '/api/auth/apple', () => this.social.apple());
  }

  @Action(DevSignIn, { cancelUncompleted: true })
  devSignIn(ctx: Ctx, { payload }: DevSignIn) {
    return this.signIn(ctx, '/api/auth/dev', async () => payload);
  }

  @Action(SignInSuccess)
  signInSuccess(ctx: Ctx, { response }: SignInSuccess) {
    tokenStorage.write(response.accessToken);
    ctx.setState({
      ...defaults,
      token: response.accessToken,
      user: response.user,
    });
  }

  @Action(SignInFail)
  signInFail(ctx: Ctx, { error }: SignInFail) {
    ctx.patchState({ submitting: false, error });
  }

  @Action(RestoreSession)
  restoreSession(ctx: Ctx) {
    const token = tokenStorage.read();
    if (!token || isTokenExpired(token)) {
      tokenStorage.clear();
      return;
    }
    ctx.patchState({ token });
    // Not returned: the app shouldn't wait for the profile to start.
    ctx.dispatch(new LoadMe());
  }

  @Action(LoadMe, { cancelUncompleted: true })
  loadMe(ctx: Ctx) {
    return this.http.get<User>('/api/me').pipe(
      mergeMap((user) => ctx.dispatch(new LoadMeSuccess(user))),
      catchError((error: HttpErrorResponse) =>
        // A rejected token signs the user out (see authInterceptor); other
        // failures keep the session so the profile can load later.
        ctx.dispatch(new LoadMeFail(httpErrorMessage(error))),
      ),
    );
  }

  @Action(LoadMeSuccess)
  loadMeSuccess(ctx: Ctx, { user }: LoadMeSuccess) {
    ctx.patchState({ user });
  }

  @Action(LoadMeFail)
  loadMeFail() {
    // Keep the session; the toolbar shows a generic label until the
    // profile loads.
  }

  @Action(UpdateProfile, { cancelUncompleted: true })
  updateProfile(ctx: Ctx, { name }: UpdateProfile) {
    ctx.patchState({ submitting: true, error: null });
    return this.http.patch<User>('/api/me', { name }).pipe(
      mergeMap((user) => ctx.dispatch(new UpdateProfileSuccess(user))),
      catchError((error: HttpErrorResponse) =>
        ctx.dispatch(new UpdateProfileFail(httpErrorMessage(error))),
      ),
    );
  }

  @Action(UpdateProfileSuccess)
  updateProfileSuccess(ctx: Ctx, { user }: UpdateProfileSuccess) {
    ctx.patchState({ user, submitting: false });
  }

  @Action(UpdateProfileFail)
  updateProfileFail(ctx: Ctx, { error }: UpdateProfileFail) {
    ctx.patchState({ submitting: false, error });
  }

  /** Setting a level, or skipping it, answers the level prompt. */
  @Action(SetLevelSuccess)
  setLevelSuccess(ctx: Ctx) {
    const { user } = ctx.getState();
    if (user && !user.levelPrompted) {
      ctx.patchState({ user: { ...user, levelPrompted: true } });
    }
  }

  @Action(DeleteAccount, { cancelUncompleted: true })
  deleteAccount(ctx: Ctx) {
    ctx.patchState({ deleting: true });
    return this.http.delete<void>('/api/me').pipe(
      mergeMap(() => ctx.dispatch(new SignOut())),
      catchError((error: HttpErrorResponse) => {
        ctx.patchState({ deleting: false });
        return ctx.dispatch(new DeleteAccountFail(httpErrorMessage(error)));
      }),
    );
  }

  @Action(SignOut)
  signOut(ctx: Ctx) {
    tokenStorage.clear();
    ctx.setState(defaults);
  }

  @Action(ClearAuthError)
  clearError(ctx: Ctx) {
    ctx.patchState({ error: null });
  }

  /**
   * Gets the request body (which may involve a provider popup), posts it
   * to a sign-in endpoint and reports the outcome.
   */
  private signIn(
    ctx: Ctx,
    url: string,
    body: () => Promise<object>,
  ): Observable<unknown> {
    ctx.patchState({ submitting: true, error: null });
    return defer(body).pipe(
      mergeMap((payload) => this.http.post<AuthResponse>(url, payload)),
      mergeMap((response) => ctx.dispatch(new SignInSuccess(response))),
      catchError((error: unknown) =>
        ctx.dispatch(new SignInFail(signInErrorMessage(error))),
      ),
    );
  }
}

function signInErrorMessage(error: unknown): string | null {
  if (error instanceof SignInCancelledError) {
    return null;
  }
  if (error instanceof HttpErrorResponse) {
    return httpErrorMessage(error);
  }
  // The provider's popup failed (blocked, misconfigured, network).
  console.error('Sign-in failed', error);
  return 'Sign-in failed. Please try again.';
}
