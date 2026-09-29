import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the original password', async () => {
    const hash = await hashPassword('correct horse battery');
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(
      true,
    );
  });

  it('rejects a different password', async () => {
    const hash = await hashPassword('correct horse battery');
    await expect(verifyPassword('wrong horse battery', hash)).resolves.toBe(
      false,
    );
  });

  it('salts each hash and embeds its parameters', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same password'),
      hashPassword('same password'),
    ]);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$[^$]+\$[^$]+$/);
    expect(a).not.toContain('same password');
  });

  it('rejects malformed hashes', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });
});
