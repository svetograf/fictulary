import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { oauthConfig } from '../config/oauth.config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts provider tokens stored in the database, so a leaked dump can't be
 * used against the provider. Output: base64url of iv | auth tag | ciphertext.
 */
@Injectable()
export class TokenCipher {
  constructor(
    @Inject(oauthConfig.KEY)
    private readonly config: Pick<
      ConfigType<typeof oauthConfig>,
      'encryptionKey'
    >,
  ) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.config.encryptionKey, iv);
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
      this.config.encryptionKey,
      data.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(data.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  }
}
