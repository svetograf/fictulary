import { Injectable } from '@angular/core';
import { DevSignInRequest } from '@fictulary/shared/models';
import { dispatch } from '@ngxs/store';
import {
  ClearAuthError,
  DeleteAccount,
  DevSignIn,
  SignInWithApple,
  SignInWithGoogle,
  SignOut,
  UpdateProfile,
} from './auth.actions';

/**
 * Entry point for components to trigger auth actions. API calls and the
 * token live in AuthState; read data through its selectors.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly dispatchGoogle = dispatch(SignInWithGoogle);
  private readonly dispatchApple = dispatch(SignInWithApple);
  private readonly dispatchDev = dispatch(DevSignIn);
  private readonly dispatchUpdateProfile = dispatch(UpdateProfile);
  private readonly dispatchDeleteAccount = dispatch(DeleteAccount);
  private readonly dispatchSignOut = dispatch(SignOut);
  private readonly dispatchClearError = dispatch(ClearAuthError);

  signInWithGoogle() {
    return this.dispatchGoogle();
  }

  signInWithApple() {
    return this.dispatchApple();
  }

  devSignIn(payload: DevSignInRequest) {
    return this.dispatchDev(payload);
  }

  updateProfile(name: string) {
    return this.dispatchUpdateProfile(name);
  }

  deleteAccount() {
    return this.dispatchDeleteAccount();
  }

  signOut() {
    return this.dispatchSignOut();
  }

  clearError() {
    return this.dispatchClearError();
  }
}
