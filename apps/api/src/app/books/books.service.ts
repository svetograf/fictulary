import {
  BOOK_TOP_WORDS_LIMIT,
  BookDetails,
  BookSummary,
  WordCount,
} from '@fictulary/shared/models';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async findAll(): Promise<BookSummary[]> {
    const [books, wordCounts] = await Promise.all([
      this.dataSource.getRepository(Book).find({
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.dataSource
        .getRepository(Word)
        .createQueryBuilder('word')
        .select('word.bookId', 'bookId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('word.bookId')
        .getRawMany<{ bookId: number; count: string }>(),
    ]);

    const uniqueWordCounts = new Map(
      wordCounts.map(({ bookId, count }) => [bookId, Number(count)]),
    );
    return books.map((book) =>
      toSummary(book, uniqueWordCounts.get(book.id) ?? 0),
    );
  }

  async findOne(id: number): Promise<BookDetails> {
    const book = await this.dataSource.getRepository(Book).findOneBy({ id });
    if (!book) {
      throw new NotFoundException(`Book ${id} not found`);
    }

    const words = this.dataSource.getRepository(Word);
    const [top, uniqueWordCount] = await Promise.all([
      words.find({
        select: { word: true, count: true },
        where: { bookId: id },
        order: { count: 'DESC', word: 'ASC' },
        take: BOOK_TOP_WORDS_LIMIT,
      }),
      words.countBy({ bookId: id }),
    ]);

    return {
      ...toSummary(book, uniqueWordCount),
      words: top.map(({ word, count }) => ({ word, count })),
    };
  }

  async create(dto: CreateBookDto, text: string): Promise<BookDetails> {
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
      ...toSummary(book, counts.size),
      words: topWords(counts, BOOK_TOP_WORDS_LIMIT),
    };
  }
}

function toSummary(book: Book, uniqueWordCount: number): BookSummary {
  return {
    id: book.id,
    name: book.name,
    description: book.description,
    status: book.status,
    wordCount: book.wordCount,
    uniqueWordCount,
    createdAt: book.createdAt.toISOString(),
  };
}

function topWords(counts: Map<string, number>, limit: number): WordCount[] {
  return Array.from(counts, ([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}
