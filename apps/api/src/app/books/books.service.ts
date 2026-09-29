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
import { DataSource, EntityManager, In } from 'typeorm';
import { CreateBookDto } from './dto/create-book.dto';
import { BookWord } from './entities/book-word.entity';
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
        .getRepository(BookWord)
        .createQueryBuilder('bookWord')
        .select('bookWord.bookId', 'bookId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('bookWord.bookId')
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

    const bookWords = this.dataSource.getRepository(BookWord);
    const [top, uniqueWordCount] = await Promise.all([
      bookWords
        .createQueryBuilder('bookWord')
        .innerJoin('bookWord.word', 'word')
        .select('word.word', 'word')
        .addSelect('bookWord.count', 'count')
        .where('bookWord.bookId = :id', { id })
        .orderBy('bookWord.count', 'DESC')
        .addOrderBy('word.word', 'ASC')
        .limit(BOOK_TOP_WORDS_LIMIT)
        .getRawMany<{ word: string; count: string }>(),
      bookWords.countBy({ bookId: id }),
    ]);

    return {
      ...toSummary(book, uniqueWordCount),
      // Raw rows skip the entity transformer, so bigint counts are strings.
      words: top.map(({ word, count }) => ({ word, count: Number(count) })),
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

      await saveWordCounts(manager, saved.id, counts);
      return saved;
    });

    return {
      ...toSummary(book, counts.size),
      words: topWords(counts, BOOK_TOP_WORDS_LIMIT),
    };
  }
}

/**
 * Adds any new words to the shared dictionary, then links them to the book
 * with their counts.
 */
async function saveWordCounts(
  manager: EntityManager,
  bookId: number,
  counts: Map<string, number>,
): Promise<void> {
  const words = [...counts.keys()];
  for (let i = 0; i < words.length; i += WORD_INSERT_CHUNK_SIZE) {
    const chunk = words.slice(i, i + WORD_INSERT_CHUNK_SIZE);
    // ON CONFLICT DO NOTHING: words already in the dictionary (possibly added
    // by a concurrent upload) are reused below.
    await manager
      .createQueryBuilder()
      .insert()
      .into(Word)
      .values(chunk.map((word) => ({ word })))
      .orIgnore()
      .execute();

    const entries = await manager.find(Word, {
      select: { id: true, word: true },
      where: { word: In(chunk) },
    });
    await manager.insert(
      BookWord,
      entries.map(({ id, word }) => ({
        bookId,
        wordId: id,
        count: counts.get(word) ?? 0,
      })),
    );
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
