import { AuthResponse } from '@fictulary/shared/models';

/** An unsigned JWT-shaped token; only the `exp` claim matters client-side. */
export function fakeJwt(expiresInSeconds = 3600): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: '1', exp })}.sig`;
}

export const ada = {
  id: 1,
  name: 'Ada',
  email: 'ada@example.com',
  createdAt: '2026-09-01T10:00:00.000Z',
};

export const authResponse = (token = fakeJwt()): AuthResponse => ({
  accessToken: token,
  user: ada,
});
