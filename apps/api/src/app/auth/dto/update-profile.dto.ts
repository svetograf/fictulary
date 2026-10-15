import {
  UpdateProfileRequest,
  USER_NAME_MAX_LENGTH,
} from '@fictulary/shared/models';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from './transforms';

export class UpdateProfileDto implements UpdateProfileRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  name!: string;
}
