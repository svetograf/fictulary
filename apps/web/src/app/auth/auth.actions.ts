import {
  AuthResponse,
  SignInRequest,
  SignUpRequest,
  User,
} from '@fictulary/shared/models';

export class SignUp {
  static readonly type = '[Auth] SIGN_UP';
  constructor(public readonly payload: SignUpRequest) {}
}

export class SignUpSuccess {
  static readonly type = '[Auth] SIGN_UP_SUCCESS';
  constructor(public readonly response: AuthResponse) {}
}

export class SignUpFail {
  static readonly type = '[Auth] SIGN_UP_FAIL';
  constructor(public readonly error: string) {}
}

export class SignIn {
  static readonly type = '[Auth] SIGN_IN';
  constructor(public readonly payload: SignInRequest) {}
}

export class SignInSuccess {
  static readonly type = '[Auth] SIGN_IN_SUCCESS';
  constructor(public readonly response: AuthResponse) {}
}

export class SignInFail {
  static readonly type = '[Auth] SIGN_IN_FAIL';
  constructor(public readonly error: string) {}
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

export class SignOut {
  static readonly type = '[Auth] SIGN_OUT';
}

export class ClearAuthError {
  static readonly type = '[Auth] CLEAR_ERROR';
}
