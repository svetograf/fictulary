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
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { TextFileValidator } from './text-file.validator';

@Controller()
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  /** Lists all books, newest first, without their words. */
  @Get('books')
  findAll(): Promise<BookSummary[]> {
    return this.booksService.findAll();
  }

  /** Returns one book with its most frequent words. */
  @Get('book/:id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<BookDetails> {
    return this.booksService.findOne(id);
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
  ): Promise<BookDetails> {
    return this.booksService.create(dto, file.buffer.toString('utf8'));
  }
}
