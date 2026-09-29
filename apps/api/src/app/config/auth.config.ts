import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Add it to apps/api/.env (see .env.example).',
    );
  }
  return {
    secret,
    /** Token lifetime, in `ms` format (e.g. "7d", "12h"). */
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  };
});
