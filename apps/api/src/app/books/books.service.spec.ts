import { BookStatus } from '@fictulary/shared/models';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BooksService } from './books.service';
import { Book } from './entities/book.entity';
import { Word } from './entities/word.entity';

describe('BooksService', () => {
  const createdAt = new Date('2026-09-01T10:00:00.000Z');
  const bookRepo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
  };
  const wordRepo = {
    find: jest.fn(),
    countBy: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const manager = {
    create: jest.fn((_entity, data) => data),
    save: jest.fn(async (book) => ({ id: 7, createdAt, ...book })),
    insert: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => unknown) =>
      run(manager as unknown as EntityManager),
    ),
    getRepository: jest.fn((entity) => (entity === Book ? bookRepo : wordRepo)),
  };
  const service = new BooksService(dataSource as unknown as DataSource);
  const dto = { name: 'My book', description: '', status: BookStatus.READING };

  beforeEach(() => jest.clearAllMocks());

  it('saves the book and word counts and returns the top words', async () => {
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
    expect(manager.insert).toHaveBeenCalledWith(
      Word,
      expect.arrayContaining([{ word: 'cat', count: 2, bookId: 7 }]),
    );
  });

  it('limits the result to the top 100 words', async () => {
    const text = Array.from({ length: 150 }, (_, i) => 'x'.repeat(i + 1)).join(
      ' ',
    );
    const result = await service.create(dto, text);
    expect(result.words).toHaveLength(100);
    expect(result.uniqueWordCount).toBe(150);
  });

  it('inserts words in chunks', async () => {
    // Distinct letter-only words: "qa", "qb", ..., "qaa", ...
    const text = Array.from(
      { length: 2500 },
      (_, i) =>
        `q${i.toString(26).replace(/./g, (d) => String.fromCharCode(97 + parseInt(d, 26)))}`,
    ).join(' ');
    await service.create(dto, text);
    expect(manager.insert).toHaveBeenCalledTimes(3);
    expect(manager.insert.mock.calls[0][1]).toHaveLength(1000);
  });

  it('rejects text without words', async () => {
    await expect(service.create(dto, '42 !!!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
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
      wordRepo.find.mockResolvedValue([
        { word: 'be', count: 6 },
        { word: 'cat', count: 4 },
      ]);
      wordRepo.countBy.mockResolvedValue(2);

      await expect(service.findOne(3)).resolves.toEqual({
        ...book,
        createdAt: '2026-09-01T10:00:00.000Z',
        uniqueWordCount: 2,
        words: [
          { word: 'be', count: 6 },
          { word: 'cat', count: 4 },
        ],
      });
      expect(wordRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookId: 3 },
          order: { count: 'DESC', word: 'ASC' },
          take: 100,
        }),
      );
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
      wordRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        // Postgres returns COUNT(*) as a string.
        getRawMany: jest.fn().mockResolvedValue([{ bookId: 2, count: '4' }]),
      });

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
