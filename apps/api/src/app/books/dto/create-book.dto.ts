import {
  BOOK_DESCRIPTION_MAX_LENGTH,
  BOOK_NAME_MAX_LENGTH,
  BookStatus,
} from '@fictulary/shared/models';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateBookDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(BOOK_NAME_MAX_LENGTH)
  name!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(BOOK_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsEnum(BookStatus)
  status!: BookStatus;
}
