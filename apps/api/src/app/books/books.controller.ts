import { BOOK_FILE_MAX_SIZE, BookResult } from '@fictulary/shared/models';
import {
  Body,
  Controller,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { TextFileValidator } from './text-file.validator';

@Controller('book')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  /**
   * Accepts a multipart form with a `.txt` file plus the book details, counts
   * the words in the file and returns the book with its most frequent words.
   * The text itself is not stored.
   */
  @Post()
  @UseInterceptors(
    // Oversized uploads are rejected by multer with 413 Payload Too Large.
    FileInterceptor('file', { limits: { fileSize: BOOK_FILE_MAX_SIZE } }),
  )
  create(
    @UploadedFile(new ParseFilePipe({ validators: [new TextFileValidator()] }))
    file: Express.Multer.File,
    @Body() dto: CreateBookDto,
  ): Promise<BookResult> {
    return this.booksService.create(dto, file.buffer.toString('utf8'));
  }
}
