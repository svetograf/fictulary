export const USER_NAME_MAX_LENGTH = 100;
/** RFC 5321 limit for an email address. */
export const USER_EMAIL_MAX_LENGTH = 254;

export interface User {
  id: number;
  /** Null until the user picks a name (see `UpdateProfileRequest`). */
  name: string | null;
  email: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
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

/** Local development only; see the API's DevAuthModule. */
export interface DevSignInRequest {
  email: string;
  /** Only used when the account is created. */
  name?: string;
}

/** What the sign-in page offers, from `GET /api/auth/providers`. */
export interface AuthProvidersConfig {
  google: { webClientId: string };
  apple: { servicesId: string; redirectUri: string };
  /** Whether `POST /api/auth/dev` is enabled. */
  devSignIn: boolean;
}

export interface UpdateProfileRequest {
  name: string;
}

export interface AuthResponse {
  /** JWT to send as `Authorization: Bearer <token>`. */
  accessToken: string;
  user: User;
}
