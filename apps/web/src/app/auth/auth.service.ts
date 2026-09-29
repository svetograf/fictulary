import { Injectable } from '@angular/core';
import { SignInRequest, SignUpRequest } from '@fictulary/shared/models';
import { dispatch } from '@ngxs/store';
import { ClearAuthError, SignIn, SignOut, SignUp } from './auth.actions';

/**
 * Entry point for components to trigger auth actions. API calls and the
 * token live in AuthState; read data through its selectors.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly dispatchSignUp = dispatch(SignUp);
  private readonly dispatchSignIn = dispatch(SignIn);
  private readonly dispatchSignOut = dispatch(SignOut);
  private readonly dispatchClearError = dispatch(ClearAuthError);

  signUp(payload: SignUpRequest) {
    return this.dispatchSignUp(payload);
  }

  signIn(payload: SignInRequest) {
    return this.dispatchSignIn(payload);
  }

  signOut() {
    return this.dispatchSignOut();
  }

  clearError() {
    return this.dispatchClearError();
  }
}
