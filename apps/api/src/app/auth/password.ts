import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// OWASP-recommended scrypt parameters (N=2^15, r=8, p=1): ~32 MiB per hash.
const COST = { N: 2 ** 15, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;

const maxmem = (N: number, r: number) => 256 * N * r;

/**
 * Hashes a password with scrypt and a random salt. The result embeds the
 * parameters (`scrypt$N$r$p$salt$hash`) so the cost can be raised later
 * without invalidating existing hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const { N, r, p } = COST;
  const key = await scryptAsync(password, salt, KEY_BYTES, {
    N,
    r,
    p,
    maxmem: maxmem(N, r),
  });
  return [
    'scrypt',
    N,
    r,
    p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, 'base64');
  const [N, R, P] = [Number(n), Number(r), Number(p)];
  const actual = await scryptAsync(
    password,
    Buffer.from(salt, 'base64'),
    expected.length,
    {
      N,
      r: R,
      p: P,
      maxmem: maxmem(N, R),
    },
  );
  return timingSafeEqual(actual, expected);
}
