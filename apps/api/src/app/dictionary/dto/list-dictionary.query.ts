import {
  DICTIONARY_DEFAULT_PAGE_SIZE,
  DICTIONARY_MAX_PAGE_SIZE,
  WordStatus,
} from '@fictulary/shared/models';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

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

  /**
   * Leaves out every word of the user's knowledge-level word list, even
   * ones also found in their books.
   */
  @IsOptional()
  // Query values are strings; anything but "true"/"false" fails IsBoolean.
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  bookWordsOnly = false;
}
