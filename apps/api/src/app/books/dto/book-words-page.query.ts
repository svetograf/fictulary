import {
  BOOK_TOP_WORDS_LIMIT,
  BOOK_WORDS_MAX_PAGE_SIZE,
} from '@fictulary/shared/models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class BookWordsPageQuery {
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
  @Max(BOOK_WORDS_MAX_PAGE_SIZE)
  pageSize = BOOK_TOP_WORDS_LIMIT;
}
