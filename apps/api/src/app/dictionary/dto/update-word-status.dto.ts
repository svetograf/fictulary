import { UpdateWordStatusRequest, WordStatus } from '@fictulary/shared/models';
import { IsEnum } from 'class-validator';

export class UpdateWordStatusDto implements UpdateWordStatusRequest {
  @IsEnum(WordStatus)
  status!: WordStatus;
}
