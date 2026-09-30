import {
  BOOK_TOP_WORDS_LIMIT,
  BookDetails,
  BookSummary,
  WordCount,
  WordStatus,
} from '@fictulary/shared/models';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { UserWord } from '../dictionary/user-word.entity';
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

  /** The user's books, newest first. */
  async findAll(userId: number): Promise<BookSummary[]> {
    const [books, wordCounts] = await Promise.all([
      this.dataSource.getRepository(Book).find({
        where: { userId },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.dataSource
        .getRepository(BookWord)
        .createQueryBuilder('bookWord')
        .innerJoin('bookWord.book', 'book')
        .where('book.userId = :userId', { userId })
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

  async findOne(userId: number, id: number): Promise<BookDetails> {
    // Other users' books are reported as missing, not forbidden, so ids
    // don't reveal which books exist.
    const book = await this.dataSource
      .getRepository(Book)
      .findOneBy({ id, userId });
    if (!book) {
      throw new NotFoundException(`Book ${id} not found`);
    }

    const [words, uniqueWordCount] = await Promise.all([
      this.wordsToLearn(userId, id),
      this.dataSource.getRepository(BookWord).countBy({ bookId: id }),
    ]);
    return { ...toSummary(book, uniqueWordCount), words };
  }

  /**
   * Stores the book's word counts and adds its words to the uploader's
   * dictionary with `dto.wordStatus` (see saveWordCounts).
   */
  async create(
    userId: number,
    dto: CreateBookDto,
    text: string,
  ): Promise<BookDetails> {
    const { total, counts } = countWords(text);
    if (total === 0) {
      throw new BadRequestException('File does not contain any words');
    }

    const book = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Book, {
          name: dto.name,
          description: dto.description || null,
          wordCount: total,
          userId,
        }),
      );

      await saveWordCounts(manager, saved, counts, dto.wordStatus);
      return saved;
    });

    // Read back after saving: which words are left to learn depends on the
    // statuses already in the user's dictionary.
    return {
      ...toSummary(book, counts.size),
      words: await this.wordsToLearn(userId, book.id),
    };
  }

  /**
   * The book's most frequent words that the user is learning or doesn't
   * know yet; known words are left out.
   */
  private async wordsToLearn(
    userId: number,
    bookId: number,
  ): Promise<WordCount[]> {
    const rows = await this.dataSource
      .getRepository(BookWord)
      .createQueryBuilder('bookWord')
      .innerJoin('bookWord.word', 'word')
      .innerJoin(
        UserWord,
        'userWord',
        'userWord.wordId = bookWord.wordId AND userWord.userId = :userId',
        { userId },
      )
      .select('bookWord.wordId', 'wordId')
      .addSelect('word.word', 'word')
      .addSelect('bookWord.count', 'count')
      .addSelect('userWord.status', 'status')
      .where('bookWord.bookId = :bookId', { bookId })
      .andWhere('userWord.status IN (:...statuses)', {
        statuses: [WordStatus.LEARNING, WordStatus.UNKNOWN],
      })
      .orderBy('bookWord.count', 'DESC')
      .addOrderBy('word.word', 'ASC')
      .limit(BOOK_TOP_WORDS_LIMIT)
      .getRawMany<{
        wordId: string;
        word: string;
        count: string;
        status: WordStatus;
      }>();
    // Raw rows skip the entity transformer, so bigint counts are strings.
    return rows.map(({ wordId, word, count, status }) => ({
      wordId: String(wordId),
      word,
      count: Number(count),
      status,
    }));
  }
}

/**
 * Adds any new words to the shared dictionary, links them to the book with
 * their counts, and adds them to the owner's dictionary: words new to it get
 * `status`; KNOWN (the book was read) also upgrades words already there.
 */
async function saveWordCounts(
  manager: EntityManager,
  book: Book,
  counts: Map<string, number>,
  status: WordStatus,
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
        bookId: book.id,
        wordId: id,
        count: counts.get(word) ?? 0,
      })),
    );

    const userWords = manager
      .createQueryBuilder()
      .insert()
      .into(UserWord)
      .values(
        entries.map(({ id }) => ({ userId: book.userId, wordId: id, status })),
      );
    await (
      status === WordStatus.KNOWN
        ? userWords.orUpdate(['status'], ['userId', 'wordId'])
        : userWords.orIgnore()
    ).execute();
  }
}

function toSummary(book: Book, uniqueWordCount: number): BookSummary {
  return {
    id: book.id,
    name: book.name,
    description: book.description,
    wordCount: book.wordCount,
    uniqueWordCount,
    createdAt: book.createdAt.toISOString(),
  };
}
