import { WordStatus } from '@fictulary/shared/models';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, FindOperator } from 'typeorm';
import { BooksService } from './books.service';
import { BookWord } from './entities/book-word.entity';
import { UserWord } from '../dictionary/user-word.entity';
import { Book } from './entities/book.entity';
import { Word } from './entities/word.entity';

describe('BooksService', () => {
  const createdAt = new Date('2026-09-01T10:00:00.000Z');

  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const manager = {
    create: jest.fn((_entity, data) => data),
    save: jest.fn(async (book) => ({ id: 7, createdAt, ...book })),
    insert: jest.fn(),
    createQueryBuilder: jest.fn(() => insertBuilder),
    // Pretend every word gets the dictionary id "<word>#".
    find: jest.fn(
      async (_entity, { where }: { where: { word: FindOperator<string[]> } }) =>
        (where.word.value as string[]).map((word) => ({
          id: `${word}#`,
          word,
        })),
    ),
  };

  const bookRepo = { find: jest.fn(), findOneBy: jest.fn() };
  const bookWordRepo = { countBy: jest.fn(), createQueryBuilder: jest.fn() };
  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => unknown) =>
      run(manager as unknown as EntityManager),
    ),
    getRepository: jest.fn((entity) =>
      entity === Book ? bookRepo : bookWordRepo,
    ),
  };

  const service = new BooksService(dataSource as unknown as DataSource);
  const dto = {
    name: 'My book',
    description: '',
    wordStatus: WordStatus.LEARNING,
  };
  const userId = 5;

  const queryBuilder = (result: unknown) => {
    const qb: Record<string, jest.Mock> = {};
    for (const method of [
      'innerJoin',
      'select',
      'addSelect',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'limit',
      'groupBy',
    ]) {
      qb[method] = jest.fn(() => qb);
    }
    qb.getRawMany = jest.fn().mockResolvedValue(result);
    return qb;
  };

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    const toLearn = [
      { wordId: '1', word: 'be', count: '2', status: WordStatus.LEARNING },
      { wordId: '2', word: 'cat', count: '2', status: WordStatus.UNKNOWN },
    ];
    let wordsQuery: Record<string, jest.Mock>;
    beforeEach(() => {
      wordsQuery = queryBuilder(toLearn);
      bookWordRepo.createQueryBuilder.mockReturnValue(wordsQuery);
    });

    it('saves the book, adds words to the dictionary and links counts', async () => {
      const result = await service.create(
        userId,
        dto,
        'The cat was here. Cats were there.',
      );

      expect(result).toEqual({
        id: 7,
        name: 'My book',
        description: null,
        wordCount: 7,
        uniqueWordCount: 5,
        createdAt: '2026-09-01T10:00:00.000Z',
        // Read back from the user's dictionary after saving.
        words: [
          { wordId: '1', word: 'be', count: 2, status: WordStatus.LEARNING },
          { wordId: '2', word: 'cat', count: 2, status: WordStatus.UNKNOWN },
        ],
      });
      expect(wordsQuery.where).toHaveBeenCalledWith(
        'bookWord.bookId = :bookId',
        {
          bookId: 7,
        },
      );

      expect(insertBuilder.into).toHaveBeenCalledWith(Word);
      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.arrayContaining([{ word: 'cat' }, { word: 'be' }]),
      );
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 5 }),
      );
      expect(manager.insert).toHaveBeenCalledWith(
        BookWord,
        expect.arrayContaining([
          { bookId: 7, wordId: 'cat#', count: 2 },
          { bookId: 7, wordId: 'be#', count: 2 },
        ]),
      );

      // New words join the uploader's dictionary; existing ones are kept.
      expect(insertBuilder.into).toHaveBeenCalledWith(UserWord);
      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          { userId: 5, wordId: 'cat#', status: WordStatus.LEARNING },
        ]),
      );
      expect(insertBuilder.orIgnore).toHaveBeenCalledTimes(2);
      expect(insertBuilder.orUpdate).not.toHaveBeenCalled();
    });

    it('marks words KNOWN, upgrading ones still to learn, for a book that was read', async () => {
      await service.create(
        userId,
        { ...dto, wordStatus: WordStatus.KNOWN },
        'The cat was here.',
      );
      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          { userId: 5, wordId: 'cat#', status: WordStatus.KNOWN },
        ]),
      );
      // Only words still to learn are upgraded: Trash and Name stay put.
      expect(insertBuilder.orUpdate).toHaveBeenCalledWith(
        ['status'],
        ['userId', 'wordId'],
        {
          overwriteCondition: {
            where: '"user_words"."status" IN (:...upgradable)',
            parameters: {
              upgradable: [WordStatus.LEARNING, WordStatus.UNKNOWN],
            },
          },
        },
      );
    });

    it('counts all distinct words, not just the ones left to learn', async () => {
      const text = Array.from({ length: 150 }, (_, i) =>
        'x'.repeat(i + 1),
      ).join(' ');
      const result = await service.create(userId, dto, text);
      expect(result.uniqueWordCount).toBe(150);
      expect(wordsQuery.limit).toHaveBeenCalledWith(100);
    });

    it('processes words in chunks', async () => {
      // Distinct letter-only words: "qa", "qb", ..., "qaa", ...
      const text = Array.from(
        { length: 2500 },
        (_, i) =>
          `q${i
            .toString(26)
            .replace(/./g, (d) => String.fromCharCode(97 + parseInt(d, 26)))}`,
      ).join(' ');
      await service.create(userId, dto, text);
      // Dictionary words and the user's words, per chunk.
      expect(insertBuilder.execute).toHaveBeenCalledTimes(6);
      expect(manager.insert).toHaveBeenCalledTimes(3);
      expect(manager.insert.mock.calls[0][1]).toHaveLength(1000);
    });

    it('rejects text without words', async () => {
      await expect(
        service.create(userId, dto, '42 !!!'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const book = {
      id: 3,
      name: 'Tale',
      description: 'Classic',
      wordCount: 10,
      createdAt,
    };

    it('returns the book with its top words still to learn', async () => {
      bookRepo.findOneBy.mockResolvedValue(book);
      // Raw query rows return bigint counts as strings.
      const qb = queryBuilder([
        { wordId: '1', word: 'be', count: '6', status: WordStatus.LEARNING },
        { wordId: '2', word: 'cat', count: '4', status: WordStatus.UNKNOWN },
      ]);
      bookWordRepo.createQueryBuilder.mockReturnValue(qb);
      bookWordRepo.countBy.mockResolvedValue(2);

      await expect(service.findOne(userId, 3)).resolves.toEqual({
        ...book,
        createdAt: '2026-09-01T10:00:00.000Z',
        uniqueWordCount: 2,
        words: [
          { wordId: '1', word: 'be', count: 6, status: WordStatus.LEARNING },
          { wordId: '2', word: 'cat', count: 4, status: WordStatus.UNKNOWN },
        ],
      });
      expect(qb.where).toHaveBeenCalledWith('bookWord.bookId = :bookId', {
        bookId: 3,
      });
      // Only the reader's own statuses, and never known words.
      expect(qb.innerJoin).toHaveBeenCalledWith(
        UserWord,
        'userWord',
        'userWord.wordId = bookWord.wordId AND userWord.userId = :userId',
        { userId: 5 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'userWord.status IN (:...statuses)',
        { statuses: [WordStatus.LEARNING, WordStatus.UNKNOWN] },
      );
      expect(qb.limit).toHaveBeenCalledWith(100);
      expect(bookWordRepo.countBy).toHaveBeenCalledWith({ bookId: 3 });
      expect(bookRepo.findOneBy).toHaveBeenCalledWith({ id: 3, userId: 5 });
    });

    it('throws when the book does not exist', async () => {
      bookRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(userId, 404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns summaries with distinct word counts', async () => {
      const summary = {
        name: 'Tale',
        description: null,
        wordCount: 10,
      };
      bookRepo.find.mockResolvedValue([
        { id: 2, ...summary, createdAt },
        { id: 1, ...summary, createdAt },
      ]);
      // Postgres returns COUNT(*) as a string.
      bookWordRepo.createQueryBuilder.mockReturnValue(
        queryBuilder([{ bookId: 2, count: '4' }]),
      );

      await expect(service.findAll(userId)).resolves.toEqual([
        {
          id: 2,
          ...summary,
          uniqueWordCount: 4,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
        {
          id: 1,
          ...summary,
          uniqueWordCount: 0,
          createdAt: '2026-09-01T10:00:00.000Z',
        },
      ]);
      expect(bookRepo.find).toHaveBeenCalledWith({
        where: { userId: 5 },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
    });
  });
});
