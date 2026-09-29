import { BookStatus } from '@fictulary/shared/models';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, FindOperator } from 'typeorm';
import { BooksService } from './books.service';
import { BookWord } from './entities/book-word.entity';
import { Book } from './entities/book.entity';
import { Word } from './entities/word.entity';

describe('BooksService', () => {
  const createdAt = new Date('2026-09-01T10:00:00.000Z');

  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
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
  const dto = { name: 'My book', description: '', status: BookStatus.READING };

  const queryBuilder = (result: unknown) => {
    const qb: Record<string, jest.Mock> = {};
    for (const method of [
      'innerJoin',
      'select',
      'addSelect',
      'where',
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
    it('saves the book, adds words to the dictionary and links counts', async () => {
      const result = await service.create(
        dto,
        'The cat was here. Cats were there.',
      );

      expect(result).toEqual({
        id: 7,
        name: 'My book',
        description: null,
        status: BookStatus.READING,
        wordCount: 7,
        uniqueWordCount: 5,
        createdAt: '2026-09-01T10:00:00.000Z',
        words: [
          { word: 'be', count: 2 },
          { word: 'cat', count: 2 },
          { word: 'here', count: 1 },
          { word: 'the', count: 1 },
          { word: 'there', count: 1 },
        ],
      });

      expect(insertBuilder.into).toHaveBeenCalledWith(Word);
      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.arrayContaining([{ word: 'cat' }, { word: 'be' }]),
      );
      expect(insertBuilder.orIgnore).toHaveBeenCalled();
      expect(manager.insert).toHaveBeenCalledWith(
        BookWord,
        expect.arrayContaining([
          { bookId: 7, wordId: 'cat#', count: 2 },
          { bookId: 7, wordId: 'be#', count: 2 },
        ]),
      );
    });

    it('limits the result to the top 100 words', async () => {
      const text = Array.from({ length: 150 }, (_, i) =>
        'x'.repeat(i + 1),
      ).join(' ');
      const result = await service.create(dto, text);
      expect(result.words).toHaveLength(100);
      expect(result.uniqueWordCount).toBe(150);
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
      await service.create(dto, text);
      expect(insertBuilder.execute).toHaveBeenCalledTimes(3);
      expect(manager.insert).toHaveBeenCalledTimes(3);
      expect(manager.insert.mock.calls[0][1]).toHaveLength(1000);
    });

    it('rejects text without words', async () => {
      await expect(service.create(dto, '42 !!!')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const book = {
      id: 3,
      name: 'Tale',
      description: 'Classic',
      status: BookStatus.READ,
      wordCount: 10,
      createdAt,
    };

    it('returns the book with its top words', async () => {
      bookRepo.findOneBy.mockResolvedValue(book);
      // Raw query rows return bigint counts as strings.
      const qb = queryBuilder([
        { word: 'be', count: '6' },
        { word: 'cat', count: '4' },
      ]);
      bookWordRepo.createQueryBuilder.mockReturnValue(qb);
      bookWordRepo.countBy.mockResolvedValue(2);

      await expect(service.findOne(3)).resolves.toEqual({
        ...book,
        createdAt: '2026-09-01T10:00:00.000Z',
        uniqueWordCount: 2,
        words: [
          { word: 'be', count: 6 },
          { word: 'cat', count: 4 },
        ],
      });
      expect(qb.where).toHaveBeenCalledWith('bookWord.bookId = :id', { id: 3 });
      expect(qb.limit).toHaveBeenCalledWith(100);
      expect(bookWordRepo.countBy).toHaveBeenCalledWith({ bookId: 3 });
    });

    it('throws when the book does not exist', async () => {
      bookRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns summaries with distinct word counts', async () => {
      const summary = {
        name: 'Tale',
        description: null,
        status: BookStatus.NOT_READ,
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

      await expect(service.findAll()).resolves.toEqual([
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
        order: { createdAt: 'DESC', id: 'DESC' },
      });
    });
  });
});
