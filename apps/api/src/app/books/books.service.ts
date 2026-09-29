import {
  BOOK_TOP_WORDS_LIMIT,
  BookResult,
  WordCount,
} from '@fictulary/shared/models';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateBookDto } from './dto/create-book.dto';
import { Book } from './entities/book.entity';
import { Word } from './entities/word.entity';
import { countWords } from './text/count-words';

/** Keeps each INSERT well below Postgres' 65535 bind-parameter limit. */
const WORD_INSERT_CHUNK_SIZE = 1000;

@Injectable()
export class BooksService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateBookDto, text: string): Promise<BookResult> {
    const { total, counts } = countWords(text);
    if (total === 0) {
      throw new BadRequestException('File does not contain any words');
    }

    const book = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Book, {
          name: dto.name,
          description: dto.description || null,
          status: dto.status,
          wordCount: total,
        }),
      );

      const rows = Array.from(counts, ([word, count]) => ({
        word,
        count,
        bookId: saved.id,
      }));
      for (let i = 0; i < rows.length; i += WORD_INSERT_CHUNK_SIZE) {
        await manager.insert(Word, rows.slice(i, i + WORD_INSERT_CHUNK_SIZE));
      }
      return saved;
    });

    return {
      id: book.id,
      name: book.name,
      description: book.description,
      status: book.status,
      wordCount: book.wordCount,
      uniqueWordCount: counts.size,
      words: topWords(counts, BOOK_TOP_WORDS_LIMIT),
    };
  }
}

function topWords(counts: Map<string, number>, limit: number): WordCount[] {
  return Array.from(counts, ([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}
