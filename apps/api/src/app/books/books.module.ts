import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NamesModule } from '../names/names.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookWord } from './entities/book-word.entity';
import { Book } from './entities/book.entity';
import { Word } from './entities/word.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Book, Word, BookWord]), NamesModule],
  controllers: [BooksController],
  providers: [BooksService],
})
export class BooksModule {}
