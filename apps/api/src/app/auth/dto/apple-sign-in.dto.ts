import {
  AppleSignInRequest,
  USER_NAME_MAX_LENGTH,
} from '@fictulary/shared/models';
import { Transform } from 'class-transformer';
import {
  IsJWT,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trim } from './transforms';

export class AppleSignInDto implements AppleSignInRequest {
  @IsJWT()
  idToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  authorizationCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nonce!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(USER_NAME_MAX_LENGTH)
  givenName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(USER_NAME_MAX_LENGTH)
  familyName?: string;
}
