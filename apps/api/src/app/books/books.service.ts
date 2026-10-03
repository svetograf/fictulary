import {
  BOOK_TOP_WORDS_LIMIT,
  BookDetails,
  BookSummary,
  BookWordsPage,
  UploadedBook,
  WORDS_TO_LEARN_STATUSES,
  WordCount,
  WordStatus,
} from '@fictulary/shared/models';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { UserWord } from '../dictionary/user-word.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { BookWord } from './entities/book-word.entity';
import { Book } from './entities/book.entity';
import { Word } from './entities/word.entity';
import { NamesService } from '../names/names.service';
import { analyzeText, countWords, nameCandidates } from './text/count-words';

/** Keeps each INSERT well below Postgres' 65535 bind-parameter limit. */
const WORD_INSERT_CHUNK_SIZE = 1000;

/** Cap for a book's words in one status (names in a novel: ~100). */
const BOOK_WORDS_BY_STATUS_LIMIT = 1000;

@Injectable()
export class BooksService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly namesService: NamesService,
  ) {}

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

    const [words, wordsToLearnCount, uniqueWordCount] = await Promise.all([
      this.wordsToLearn(userId, id),
      this.countBookWords(userId, id, WORDS_TO_LEARN_STATUSES),
      this.dataSource.getRepository(BookWord).countBy({ bookId: id }),
    ]);
    return { ...toSummary(book, uniqueWordCount), words, wordsToLearnCount };
  }

  /**
   * Stores the book's word counts and adds its words to the uploader's
   * dictionary with `dto.wordStatus` (see saveWordCounts).
   */
  async create(
    userId: number,
    dto: CreateBookDto,
    text: string,
  ): Promise<UploadedBook> {
    const analysis = analyzeText(text);
    if (analysis.total === 0) {
      throw new BadRequestException('File does not contain any words');
    }
    // Words written like proper nouns that are also in the names list.
    const names = await this.namesService.findNames(nameCandidates(analysis));
    const { total, counts, names: nameWords } = countWords(analysis, names);

    let markedAsNames: string[] = [];
    const book = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Book, {
          name: dto.name,
          description: dto.description || null,
          wordCount: total,
          userId,
        }),
      );

      markedAsNames = await saveWordCounts(
        manager,
        saved,
        counts,
        dto.wordStatus,
        nameWords,
      );
      return saved;
    });

    // Read back after saving: which words are left to learn depends on the
    // statuses already in the user's dictionary.
    return {
      ...toSummary(book, counts.size),
      words: await this.wordsToLearn(userId, book.id),
      wordsToLearnCount: await this.countBookWords(
        userId,
        book.id,
        WORDS_TO_LEARN_STATUSES,
      ),
      markedAsNames: markedAsNames.sort(
        (a, b) =>
          (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
      ),
    };
  }

  /**
   * Deletes one of the user's books. Words that were only in this book leave
   * the user's dictionary (with their status), and words no book uses any
   * more leave the shared word list.
   */
  async remove(userId: number, id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const book = await manager.findOneBy(Book, { id, userId });
      if (!book) {
        throw new NotFoundException(`Book ${id} not found`);
      }
      const bookWordIds = `SELECT "wordId" FROM "book_words" WHERE "bookId" = $1`;

      // The user's words found in none of their other books.
      await manager.query(
        `DELETE FROM "user_words" uw
         WHERE uw."userId" = $2
           AND uw."wordId" IN (${bookWordIds})
           AND NOT EXISTS (
             SELECT 1 FROM "book_words" bw
             JOIN "books" b ON b."id" = bw."bookId"
             WHERE bw."wordId" = uw."wordId" AND b."userId" = $2 AND b."id" <> $1
           )`,
        [id, userId],
      );
      // Words in no other book at all, of any user.
      await manager.query(
        `DELETE FROM "words" w
         WHERE w."id" IN (${bookWordIds})
           AND NOT EXISTS (
             SELECT 1 FROM "book_words" bw
             WHERE bw."wordId" = w."id" AND bw."bookId" <> $1
           )`,
        [id],
      );
      // Its word counts go with it (ON DELETE CASCADE).
      await manager.delete(Book, { id });
    });
  }

  /**
   * A page of the book's words to learn, most used first. The book object
   * carries the first 100; this serves the pages after them.
   */
  async wordsToLearnPage(
    userId: number,
    bookId: number,
    page: number,
    pageSize: number,
  ): Promise<BookWordsPage> {
    await this.assertOwnBook(userId, bookId);
    const [items, total] = await Promise.all([
      this.bookWords(
        userId,
        bookId,
        WORDS_TO_LEARN_STATUSES,
        pageSize,
        (page - 1) * pageSize,
      ),
      this.countBookWords(userId, bookId, WORDS_TO_LEARN_STATUSES),
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * The book's words that have `status` in the user's dictionary, most used
   * first; used to review the names found in a new book.
   */
  async wordsWithStatus(
    userId: number,
    bookId: number,
    status: WordStatus,
  ): Promise<WordCount[]> {
    await this.assertOwnBook(userId, bookId);
    return this.bookWords(userId, bookId, [status], BOOK_WORDS_BY_STATUS_LIMIT);
  }

  /**
   * The book's most frequent words that the user is learning or doesn't
   * know yet; known words are left out.
   */
  private wordsToLearn(userId: number, bookId: number): Promise<WordCount[]> {
    return this.bookWords(
      userId,
      bookId,
      WORDS_TO_LEARN_STATUSES,
      BOOK_TOP_WORDS_LIMIT,
    );
  }

  /** The book's words with one of `statuses`, most used first. */
  private async bookWords(
    userId: number,
    bookId: number,
    statuses: readonly WordStatus[],
    limit: number,
    offset = 0,
  ): Promise<WordCount[]> {
    const rows = await this.bookWordsQuery(userId, bookId, statuses)
      .select('bookWord.wordId', 'wordId')
      .addSelect('word.word', 'word')
      .addSelect('bookWord.count', 'count')
      .addSelect('userWord.status', 'status')
      .orderBy('bookWord.count', 'DESC')
      .addOrderBy('word.word', 'ASC')
      .offset(offset)
      .limit(limit)
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

  private countBookWords(
    userId: number,
    bookId: number,
    statuses: readonly WordStatus[],
  ): Promise<number> {
    return this.bookWordsQuery(userId, bookId, statuses).getCount();
  }

  /** The book's words whose status in the user's dictionary is one of these. */
  private bookWordsQuery(
    userId: number,
    bookId: number,
    statuses: readonly WordStatus[],
  ): SelectQueryBuilder<BookWord> {
    return this.dataSource
      .getRepository(BookWord)
      .createQueryBuilder('bookWord')
      .innerJoin('bookWord.word', 'word')
      .innerJoin(
        UserWord,
        'userWord',
        'userWord.wordId = bookWord.wordId AND userWord.userId = :userId',
        { userId },
      )
      .where('bookWord.bookId = :bookId', { bookId })
      .andWhere('userWord.status IN (:...statuses)', { statuses });
  }

  /** Other users' books are reported as missing, not forbidden. */
  private async assertOwnBook(userId: number, bookId: number): Promise<void> {
    const own = await this.dataSource
      .getRepository(Book)
      .existsBy({ id: bookId, userId });
    if (!own) {
      throw new NotFoundException(`Book ${bookId} not found`);
    }
  }
}

/**
 * Adds any new words to the shared dictionary, links them to the book with
 * their counts, and adds them to the owner's dictionary: words new to it get
 * `status`; KNOWN (the book was read) also upgrades words already there that
 * are still to learn.
 */
async function saveWordCounts(
  manager: EntityManager,
  book: Book,
  counts: Map<string, number>,
  status: WordStatus,
  names: ReadonlySet<string>,
): Promise<string[]> {
  const markedAsNames: string[] = [];
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

    const nameEntries = entries.filter(({ word }) => names.has(word));
    const otherEntries = entries.filter(({ word }) => !names.has(word));
    await saveUserWords(manager, book.userId, otherEntries, status);
    markedAsNames.push(...(await saveNames(manager, book.userId, nameEntries)));
  }
  return markedAsNames;
}

async function saveUserWords(
  manager: EntityManager,
  userId: number,
  entries: Pick<Word, 'id' | 'word'>[],
  status: WordStatus,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  const userWords = manager
    .createQueryBuilder()
    .insert()
    .into(UserWord)
    .values(entries.map(({ id }) => ({ userId, wordId: id, status })));
  await (
    status === WordStatus.KNOWN
      ? // Only upgrade words still being learned: words the user put in
        // Trash or Name stay there.
        userWords.orUpdate(['status'], ['userId', 'wordId'], {
          overwriteCondition: {
            where: '"user_words"."status" IN (:...upgradable)',
            parameters: { upgradable: WORDS_TO_LEARN_STATUSES },
          },
        })
      : userWords.orIgnore()
  ).execute();
}

/**
 * Puts recognized names in the user's dictionary as NAME: words new to it,
 * and words still UNKNOWN. Statuses the user chose are kept. Returns the
 * words that were marked.
 */
async function saveNames(
  manager: EntityManager,
  userId: number,
  entries: Pick<Word, 'id' | 'word'>[],
): Promise<string[]> {
  if (entries.length === 0) {
    return [];
  }
  const result = await manager
    .createQueryBuilder()
    .insert()
    .into(UserWord)
    .values(
      entries.map(({ id }) => ({
        userId,
        wordId: id,
        status: WordStatus.NAME,
      })),
    )
    .orUpdate(['status'], ['userId', 'wordId'], {
      overwriteCondition: {
        where: '"user_words"."status" = :unknown',
        parameters: { unknown: WordStatus.UNKNOWN },
      },
    })
    // Only inserted or updated rows come back.
    .returning(['wordId'])
    .execute();
  const marked = new Set(
    (result.raw as { wordId: string }[]).map(({ wordId }) => String(wordId)),
  );
  return entries
    .filter(({ id }) => marked.has(String(id)))
    .map(({ word }) => word);
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
