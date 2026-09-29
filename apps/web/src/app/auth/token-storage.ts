const TOKEN_KEY = 'fictulary.accessToken';

/**
 * localStorage access for the access token. Storage can be unavailable
 * (private mode, blocked site data), so every call tolerates failures.
 */
export const tokenStorage = {
  read(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  write(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // The session still works for this tab; it just won't survive reloads.
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing to clear.
    }
  },
};
