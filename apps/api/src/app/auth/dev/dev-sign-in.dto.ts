import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from '@fictulary/shared/models';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../dto/transforms';

export class DevSignInDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email!: string;

  /** Only used when the account is created; omit to test the name prompt. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(USER_NAME_MAX_LENGTH)
  name?: string;
}
