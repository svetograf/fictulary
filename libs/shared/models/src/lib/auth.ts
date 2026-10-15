export const USER_NAME_MAX_LENGTH = 100;
/** RFC 5321 limit for an email address. */
export const USER_EMAIL_MAX_LENGTH = 254;
// Password limits and the sign-up/sign-in requests below go away with the
// web app's email sign-in pages; the API no longer accepts passwords.
export const USER_PASSWORD_MIN_LENGTH = 8;
/** Caps the work spent hashing a single password. */
export const USER_PASSWORD_MAX_LENGTH = 128;

export interface User {
  id: number;
  /** Null until the user picks a name (see `UpdateProfileRequest`). */
  name: string | null;
  email: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export enum AuthProvider {
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
}

export interface GoogleSignInRequest {
  /** Google ID token (JWT) from the sign-in flow. */
  idToken: string;
}

export interface AppleSignInRequest {
  /** Apple ID token (JWT) from the sign-in flow. */
  idToken: string;
  /** Single-use code, exchanged for a refresh token to revoke on deletion. */
  authorizationCode: string;
  /** The raw nonce; Apple received its SHA-256 hex digest. */
  nonce: string;
  /** Sent by Apple to the client only on the first authorization. */
  givenName?: string;
  familyName?: string;
}

export interface UpdateProfileRequest {
  name: string;
}

export interface AuthResponse {
  /** JWT to send as `Authorization: Bearer <token>`. */
  accessToken: string;
  user: User;
}
