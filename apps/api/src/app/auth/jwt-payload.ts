export interface JwtPayload {
  /** User id, as a string per the JWT spec. */
  sub: string;
  email: string;
}

/** The authenticated user attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: number;
  email: string;
}
