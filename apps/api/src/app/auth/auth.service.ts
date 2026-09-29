import { AuthResponse, User as UserDto } from '@fictulary/shared/models';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { JwtPayload } from './jwt-payload';
import { hashPassword, verifyPassword } from './password';

const PG_UNIQUE_VIOLATION = '23505';
const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  /**
   * Hash compared against when the email is unknown, so a failed sign-in
   * takes the same time whether or not the account exists.
   */
  private dummyHash?: Promise<string>;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async signUp(dto: SignUpDto): Promise<AuthResponse> {
    if (await this.users.existsBy({ email: dto.email })) {
      throw new ConflictException('An account with this email already exists');
    }

    let user: User;
    try {
      user = await this.users.save(
        this.users.create({
          name: dto.name,
          email: dto.email,
          passwordHash: await hashPassword(dto.password),
        }),
      );
    } catch (error) {
      // Lost a race with a concurrent sign-up for the same email.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
    return this.authResponse(user);
  }

  async signIn(dto: SignInDto): Promise<AuthResponse> {
    const user = await this.users.findOneBy({ email: dto.email });
    if (!user) {
      await verifyPassword(dto.password, await this.getDummyHash());
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.authResponse(user);
  }

  async me(userId: number): Promise<UserDto> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      // The token is valid but the account no longer exists.
      throw new UnauthorizedException('Account not found');
    }
    return toUserDto(user);
  }

  private async authResponse(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: String(user.id), email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: toUserDto(user),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword('dummy password for timing');
    return this.dummyHash;
  }
}

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}
