import {
  BOOK_FILE_MAX_SIZE,
  BookDetails,
  BookSummary,
} from '@fictulary/shared/models';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt-payload';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { TextFileValidator } from './text-file.validator';

@Controller()
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  /** Lists the user's books, newest first, without their words. */
  @Get('books')
  findAll(@CurrentUser() user: AuthUser): Promise<BookSummary[]> {
    return this.booksService.findAll(user.id);
  }

  /** Returns one book with its most frequent words. */
  @Get('book/:id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BookDetails> {
    return this.booksService.findOne(user.id, id);
  }

  /**
   * Accepts a multipart form with a `.txt` file plus the book details, counts
   * the words in the file and returns the book with its most frequent words.
   * The text itself is not stored.
   */
  @Post('book')
  @UseInterceptors(
    // Oversized uploads are rejected by multer with 413 Payload Too Large.
    FileInterceptor('file', { limits: { fileSize: BOOK_FILE_MAX_SIZE } }),
  )
  create(
    @UploadedFile(new ParseFilePipe({ validators: [new TextFileValidator()] }))
    file: Express.Multer.File,
    @Body() dto: CreateBookDto,
    @CurrentUser() user: AuthUser,
  ): Promise<BookDetails> {
    return this.booksService.create(user.id, dto, file.buffer.toString('utf8'));
  }
}
