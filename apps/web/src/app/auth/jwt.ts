/**
 * Whether a JWT is expired (or unreadable), judged by its `exp` claim.
 * Only for skipping tokens we know are stale; the server still verifies
 * every token's signature.
 */
export function isTokenExpired(token: string, now = Date.now()): boolean {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp === 'number' && exp * 1000 <= now;
  } catch {
    return true;
  }
}
