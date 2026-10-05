import { WordStatus } from '@fictulary/shared/models';
import { IsEnum } from 'class-validator';

export class BookWordsQuery {
  @IsEnum(WordStatus)
  status!: WordStatus;
}
