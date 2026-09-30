import {
  DICTIONARY_DEFAULT_PAGE_SIZE,
  DICTIONARY_MAX_PAGE_SIZE,
  WordStatus,
} from '@fictulary/shared/models';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListDictionaryQuery {
  @IsOptional()
  @IsEnum(WordStatus)
  status: WordStatus = WordStatus.KNOWN;

  /** 1-based. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DICTIONARY_MAX_PAGE_SIZE)
  pageSize = DICTIONARY_DEFAULT_PAGE_SIZE;
}
