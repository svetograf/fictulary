import { BookStatus } from '@fictulary/shared/models';
import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BooksService } from './books.service';
import { Word } from './entities/word.entity';

describe('BooksService', () => {
  const manager = {
    create: jest.fn((_entity, data) => data),
    save: jest.fn(async (book) => ({ id: 7, ...book })),
    insert: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => unknown) =>
      run(manager as unknown as EntityManager),
    ),
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
});
