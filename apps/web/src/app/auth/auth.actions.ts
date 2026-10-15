import { AuthResponse, DevSignInRequest, User } from '@fictulary/shared/models';

export class SignInWithGoogle {
  static readonly type = '[Auth] SIGN_IN_WITH_GOOGLE';
}

export class SignInWithApple {
  static readonly type = '[Auth] SIGN_IN_WITH_APPLE';
}

/** Local development only; the API enables it with AUTH_DEV_LOGIN. */
export class DevSignIn {
  static readonly type = '[Auth] DEV_SIGN_IN';
  constructor(public readonly payload: DevSignInRequest) {}
}

export class SignInSuccess {
  static readonly type = '[Auth] SIGN_IN_SUCCESS';
  constructor(public readonly response: AuthResponse) {}
}

export class SignInFail {
  /** `null` when the user cancelled, which needs no message. */
  static readonly type = '[Auth] SIGN_IN_FAIL';
  constructor(public readonly error: string | null) {}
}

/** Copies a saved token from localStorage into the store on app load. */
export class RestoreSession {
  static readonly type = '[Auth] RESTORE_SESSION';
}

export class LoadMe {
  static readonly type = '[Auth] LOAD_ME';
}

export class LoadMeSuccess {
  static readonly type = '[Auth] LOAD_ME_SUCCESS';
  constructor(public readonly user: User) {}
}

export class LoadMeFail {
  static readonly type = '[Auth] LOAD_ME_FAIL';
  constructor(public readonly error: string) {}
}

export class UpdateProfile {
  static readonly type = '[Auth] UPDATE_PROFILE';
  constructor(public readonly name: string) {}
}

export class UpdateProfileSuccess {
  static readonly type = '[Auth] UPDATE_PROFILE_SUCCESS';
  constructor(public readonly user: User) {}
}

export class UpdateProfileFail {
  static readonly type = '[Auth] UPDATE_PROFILE_FAIL';
  constructor(public readonly error: string) {}
}

export class DeleteAccount {
  static readonly type = '[Auth] DELETE_ACCOUNT';
}

export class DeleteAccountFail {
  static readonly type = '[Auth] DELETE_ACCOUNT_FAIL';
  constructor(public readonly error: string) {}
}

export class SignOut {
  static readonly type = '[Auth] SIGN_OUT';
}

export class ClearAuthError {
  static readonly type = '[Auth] CLEAR_ERROR';
}
