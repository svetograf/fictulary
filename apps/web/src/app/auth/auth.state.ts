import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthResponse, User } from '@fictulary/shared/models';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { catchError, mergeMap } from 'rxjs';
import { httpErrorMessage } from '../shared/http-error-message';
import {
  ClearAuthError,
  LoadMe,
  LoadMeFail,
  LoadMeSuccess,
  RestoreSession,
  SignIn,
  SignInFail,
  SignInSuccess,
  SignOut,
  SignUp,
  SignUpFail,
  SignUpSuccess,
} from './auth.actions';
import { isTokenExpired } from './jwt';
import { tokenStorage } from './token-storage';

export interface AuthStateModel {
  /** JWT for API requests; mirrored in localStorage. */
  token: string | null;
  user: User | null;
  /** A sign-in or sign-up request is in flight. */
  submitting: boolean;
  error: string | null;
}

const defaults: AuthStateModel = {
  token: null,
  user: null,
  submitting: false,
  error: null,
};

type Ctx = StateContext<AuthStateModel>;

@State<AuthStateModel>({ name: 'auth', defaults })
@Injectable()
export class AuthState {
  private readonly http = inject(HttpClient);

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
  static error(state: AuthStateModel): string | null {
    return state.error;
  }

  @Action(SignUp, { cancelUncompleted: true })
  signUp(ctx: Ctx, { payload }: SignUp) {
    ctx.patchState({ submitting: true, error: null });
    return this.http.post<AuthResponse>('/api/sign-up', payload).pipe(
      mergeMap((response) => ctx.dispatch(new SignUpSuccess(response))),
      catchError((error: HttpErrorResponse) =>
        ctx.dispatch(new SignUpFail(httpErrorMessage(error))),
      ),
    );
  }

  @Action(SignIn, { cancelUncompleted: true })
  signIn(ctx: Ctx, { payload }: SignIn) {
    ctx.patchState({ submitting: true, error: null });
    return this.http.post<AuthResponse>('/api/sign-in', payload).pipe(
      mergeMap((response) => ctx.dispatch(new SignInSuccess(response))),
      catchError((error: HttpErrorResponse) =>
        ctx.dispatch(new SignInFail(httpErrorMessage(error))),
      ),
    );
  }

  @Action([SignUpSuccess, SignInSuccess])
  authenticated(ctx: Ctx, { response }: SignUpSuccess | SignInSuccess) {
    tokenStorage.write(response.accessToken);
    ctx.setState({
      ...defaults,
      token: response.accessToken,
      user: response.user,
    });
  }

  @Action([SignUpFail, SignInFail])
  authenticationFailed(ctx: Ctx, { error }: SignUpFail | SignInFail) {
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

  @Action(SignOut)
  signOut(ctx: Ctx) {
    tokenStorage.clear();
    ctx.setState(defaults);
  }

  @Action(ClearAuthError)
  clearError(ctx: Ctx) {
    ctx.patchState({ error: null });
  }
}
