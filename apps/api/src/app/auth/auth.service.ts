import {
  AuthProvider,
  AuthResponse,
  USER_NAME_MAX_LENGTH,
  User as UserDto,
} from '@fictulary/shared/models';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  DataSource,
  EntityManager,
  Not,
  IsNull,
  QueryFailedError,
} from 'typeorm';
import { AuthIdentity } from '../users/auth-identity.entity';
import { User } from '../users/user.entity';
import { AppleSignInDto } from './dto/apple-sign-in.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './jwt-payload';
import { AppleClient } from './providers/apple-client';
import { GoogleVerifier } from './providers/google-verifier';
import { ProviderProfile } from './providers/provider-profile';
import { TokenCipher } from './token-cipher';

const PG_UNIQUE_VIOLATION = '23505';

/** Apple details stored with the identity, to revoke access on deletion. */
interface AppleToken {
  refreshToken: string;
  clientId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly google: GoogleVerifier,
    private readonly apple: AppleClient,
    private readonly cipher: TokenCipher,
  ) {}

  async signInWithGoogle(dto: GoogleSignInDto): Promise<AuthResponse> {
    const profile = await this.google.verify(dto.idToken);
    return this.authResponse(await this.findOrCreateUser(profile));
  }

  async signInWithApple(dto: AppleSignInDto): Promise<AuthResponse> {
    const { clientId, ...profile } = await this.apple.verify(
      dto.idToken,
      dto.nonce,
    );
    profile.name = joinName(dto.givenName, dto.familyName);

    // Exchange the code only until we hold a refresh token: one is enough
    // to revoke access later, and it doesn't expire.
    const hasToken = await this.dataSource
      .getRepository(AuthIdentity)
      .existsBy({
        provider: AuthProvider.APPLE,
        subject: profile.subject,
        appleRefreshToken: Not(IsNull()),
      });
    const appleToken = hasToken
      ? undefined
      : {
          refreshToken: await this.apple.exchangeCode(
            dto.authorizationCode,
            clientId,
          ),
          clientId,
        };

    return this.authResponse(await this.findOrCreateUser(profile, appleToken));
  }

  /** Signs in by email alone. Only reachable through DevAuthModule. */
  async devSignIn(email: string, name?: string): Promise<AuthResponse> {
    const users = this.dataSource.getRepository(User);
    const user =
      (await users.findOneBy({ email })) ??
      (await users.save(users.create({ email, name: name || null })));
    return this.authResponse(user);
  }

  async me(userId: number): Promise<UserDto> {
    return toUserDto(await this.findUser(this.dataSource.manager, userId));
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserDto> {
    const users = this.dataSource.getRepository(User);
    const user = await this.findUser(this.dataSource.manager, userId);
    user.name = dto.name;
    return toUserDto(await users.save(user));
  }

  /**
   * Deletes the account and everything it owns. Apple access is revoked
   * first, as App Store rules require; a failed revocation is logged rather
   * than blocking the deletion.
   */
  async deleteAccount(userId: number): Promise<void> {
    const identities = await this.dataSource
      .getRepository(AuthIdentity)
      .findBy({
        userId,
        provider: AuthProvider.APPLE,
        appleRefreshToken: Not(IsNull()),
      });
    if (identities.length && !this.apple.enabled) {
      this.logger.warn(
        `Can't revoke Apple access for user ${userId}: Apple isn't configured`,
      );
    }
    for (const identity of this.apple.enabled ? identities : []) {
      try {
        await this.apple.revoke(
          this.cipher.decrypt(identity.appleRefreshToken as string),
          identity.appleClientId as string,
        );
      } catch (error) {
        this.logger.warn(
          `Revoking Apple access for user ${userId} failed: ${String(error)}`,
        );
      }
    }
    await this.dataSource.getRepository(User).delete({ id: userId });
  }

  /**
   * Finds the user a provider identity belongs to, linking it to an
   * existing account with the same verified email, or creating one.
   */
  private async findOrCreateUser(
    profile: ProviderProfile,
    appleToken?: AppleToken,
  ): Promise<User> {
    const attempt = () =>
      this.dataSource.transaction((manager) =>
        this.findOrCreateIn(manager, profile, appleToken),
      );
    try {
      return await attempt();
    } catch (error) {
      // Lost a race with a concurrent first sign-in; the retry finds the
      // rows the other request created.
      if (isUniqueViolation(error)) {
        return attempt();
      }
      throw error;
    }
  }

  private async findOrCreateIn(
    manager: EntityManager,
    profile: ProviderProfile,
    appleToken?: AppleToken,
  ): Promise<User> {
    const users = manager.getRepository(User);
    const identities = manager.getRepository(AuthIdentity);
    const tokenFields = appleToken && {
      appleRefreshToken: this.cipher.encrypt(appleToken.refreshToken),
      appleClientId: appleToken.clientId,
    };

    let user: User;
    const identity = await identities.findOneBy({
      provider: profile.provider,
      subject: profile.subject,
    });
    if (identity) {
      user = await this.findUser(manager, identity.userId);
      if (tokenFields) {
        await identities.update({ id: identity.id }, tokenFields);
      }
    } else {
      const existing = await users.findOneBy({ email: profile.email });
      if (existing && !profile.emailVerified) {
        // Linking on an unverified email would let anyone claim the account.
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      user =
        existing ??
        (await users.save(
          users.create({ email: profile.email, name: profile.name }),
        ));
      await identities.save(
        identities.create({
          userId: user.id,
          provider: profile.provider,
          subject: profile.subject,
          email: profile.email,
          ...tokenFields,
        }),
      );
    }

    if (!user.name && profile.name) {
      user.name = profile.name;
      user = await users.save(user);
    }
    return user;
  }

  private async findUser(manager: EntityManager, id: number): Promise<User> {
    const user = await manager.getRepository(User).findOneBy({ id });
    if (!user) {
      // The token is valid but the account no longer exists.
      throw new UnauthorizedException('Account not found');
    }
    return user;
  }

  private async authResponse(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: String(user.id), email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: toUserDto(user),
    };
  }
}

/** A display name from name parts, or null if there are none. */
function joinName(...parts: (string | undefined)[]): string | null {
  const name = parts.filter(Boolean).join(' ').trim();
  return name ? name.slice(0, USER_NAME_MAX_LENGTH) : null;
}

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    // Unset, not null, on a user just created.
    levelPrompted: Boolean(user.levelPromptedAt),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}
