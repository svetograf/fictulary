export const USER_NAME_MAX_LENGTH = 100;
/** RFC 5321 limit for an email address. */
export const USER_EMAIL_MAX_LENGTH = 254;
export const USER_PASSWORD_MIN_LENGTH = 8;
/** Caps the work spent hashing a single password. */
export const USER_PASSWORD_MAX_LENGTH = 128;

export interface User {
  id: number;
  name: string;
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

export interface AuthResponse {
  /** JWT to send as `Authorization: Bearer <token>`. */
  accessToken: string;
  user: User;
}
