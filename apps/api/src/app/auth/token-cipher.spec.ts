import { TokenCipher } from './token-cipher';

describe('TokenCipher', () => {
  const cipher = new TokenCipher({ encryptionKey: Buffer.alloc(32, 1) });

  it('round-trips a token', () => {
    const encrypted = cipher.encrypt('refresh-token');
    expect(encrypted).not.toContain('refresh-token');
    expect(cipher.decrypt(encrypted)).toBe('refresh-token');
  });

  it('uses a fresh IV each time', () => {
    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('rejects tampered data', () => {
    const data = Buffer.from(cipher.encrypt('refresh-token'), 'base64url');
    data[data.length - 1] ^= 1;
    expect(() => cipher.decrypt(data.toString('base64url'))).toThrow();
  });

  it('rejects data encrypted with another key', () => {
    const other = new TokenCipher({ encryptionKey: Buffer.alloc(32, 2) });
    expect(() => cipher.decrypt(other.encrypt('refresh-token'))).toThrow();
  });
});
