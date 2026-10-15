import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AppleConfig, oauthConfig } from '../config/oauth.config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts provider tokens stored in the database, so a leaked dump can't be
 * used against the provider. Output: base64url of iv | auth tag | ciphertext.
 * Only Apple tokens are stored, so the key is part of the Apple config.
 */
@Injectable()
export class TokenCipher {
  constructor(
    @Inject(oauthConfig.KEY)
    private readonly config: {
      apple: Pick<AppleConfig, 'encryptionKey'> | null;
    },
  ) {}

  private get key(): Buffer {
    if (!this.config.apple) {
      throw new Error('TokenCipher needs the Apple config, which is not set');
    }
    return this.config.apple.encryptionKey;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
      'base64url',
    );
  }

  decrypt(encrypted: string): string {
    const data = Buffer.from(encrypted, 'base64url');
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      data.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(data.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  }
}
