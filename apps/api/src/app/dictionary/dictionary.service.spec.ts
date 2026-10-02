import { NameKind, WordStatus } from '@fictulary/shared/models';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NamesService } from '../names/names.service';
import { DictionaryService } from './dictionary.service';

describe('DictionaryService', () => {
  const row = {
    wordId: '12',
    word: 'phone',
    status: WordStatus.LEARNING,
    count: '42',
    bookCount: '2',
  };
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
    'offset',
    'limit',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getRawOne = jest.fn();
  qb.getRawMany = jest.fn();
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn(),
    countBy: jest.fn(),
  };
  const namesService = { kindsOf: jest.fn() };
  const service = new DictionaryService(
    { getRepository: () => repo } as unknown as DataSource,
    namesService as unknown as NamesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('lists a page of words, converting counts to numbers', async () => {
    qb.getRawMany.mockResolvedValue([row]);
    repo.countBy.mockResolvedValue(120);

    await expect(service.list(5, WordStatus.LEARNING, 3, 50)).resolves.toEqual({
      items: [
        {
          wordId: '12',
          word: 'phone',
          status: WordStatus.LEARNING,
          count: 42,
          bookCount: 2,
        },
      ],
      total: 120,
      page: 3,
      pageSize: 50,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('uw.status = :status', {
      status: WordStatus.LEARNING,
    });
    expect(qb.orderBy).toHaveBeenCalledWith('SUM(bw.count)', 'DESC');
    expect(qb.offset).toHaveBeenCalledWith(100);
    expect(qb.limit).toHaveBeenCalledWith(50);
    expect(repo.countBy).toHaveBeenCalledWith({
      userId: 5,
      status: WordStatus.LEARNING,
    });
  });

  it('changes a word status within the user dictionary', async () => {
    repo.update.mockResolvedValue({ affected: 1 });
    qb.getRawOne.mockResolvedValue({ ...row, status: WordStatus.KNOWN });

    await expect(
      service.updateStatus(5, '12', WordStatus.KNOWN),
    ).resolves.toMatchObject({
      status: WordStatus.KNOWN,
    });
    expect(repo.update).toHaveBeenCalledWith(
      { userId: 5, wordId: '12' },
      { status: WordStatus.KNOWN },
    );
  });

  it("refuses to change words outside the user's dictionary", async () => {
    repo.update.mockResolvedValue({ affected: 0 });
    await expect(
      service.updateStatus(5, '999', WordStatus.KNOWN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marking a word viewed only promotes UNKNOWN to LEARNING', async () => {
    repo.update.mockResolvedValue({ affected: 0 });
    qb.getRawOne.mockResolvedValue({ ...row, status: WordStatus.KNOWN });

    await expect(service.markViewed(5, '12')).resolves.toMatchObject({
      status: WordStatus.KNOWN,
    });
    expect(repo.update).toHaveBeenCalledWith(
      { userId: 5, wordId: '12', status: WordStatus.UNKNOWN },
      { status: WordStatus.LEARNING },
    );
  });

  it('reports words missing from the dictionary', async () => {
    qb.getRawOne.mockResolvedValue(undefined);
    await expect(service.markViewed(5, '999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('includes what the word names, if it is in the names list', async () => {
    qb.getRawOne.mockResolvedValue({ ...row, word: 'london' });
    qb.getRawMany.mockResolvedValue([{ bookId: 3, name: 'Tale', count: '7' }]);
    namesService.kindsOf.mockResolvedValue([NameKind.PERSON, NameKind.CITY]);

    await expect(service.details(5, '12')).resolves.toMatchObject({
      word: 'london',
      books: [{ bookId: 3, name: 'Tale', count: 7 }],
      nameKinds: [NameKind.PERSON, NameKind.CITY],
    });
    expect(namesService.kindsOf).toHaveBeenCalledWith('london');
  });
});
