import {
  BOOK_FILE_MAX_SIZE,
  BookDetails,
  BookSummary,
  BookWordsPage,
  UploadedBook,
  WordCount,
} from '@fictulary/shared/models';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt-payload';
import { BooksService } from './books.service';
import { BookWordsPageQuery } from './dto/book-words-page.query';
import { BookWordsQuery } from './dto/book-words.query';
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
   * Deletes the book. Words left in none of the user's books leave their
   * dictionary too.
   */
  @Delete('book/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.booksService.remove(user.id, id);
  }

  /** A page of the book's words to learn; the book carries the first 100. */
  @Get('book/:id/words-to-learn')
  wordsToLearnPage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: BookWordsPageQuery,
  ): Promise<BookWordsPage> {
    return this.booksService.wordsToLearnPage(
      user.id,
      id,
      query.page,
      query.pageSize,
    );
  }

  /** The book's words in one status, e.g. the names found in it. */
  @Get('book/:id/words')
  wordsWithStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: BookWordsQuery,
  ): Promise<WordCount[]> {
    return this.booksService.wordsWithStatus(user.id, id, query.status);
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
  ): Promise<UploadedBook> {
    return this.booksService.create(user.id, dto, file.buffer.toString('utf8'));
  }
}
