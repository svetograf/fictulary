import { NameKind } from '@fictulary/shared/models';
import { Repository } from 'typeorm';
import { Name } from './name.entity';
import { NamesService } from './names.service';

describe('NamesService', () => {
  const repo = { find: jest.fn() };
  const service = new NamesService(repo as unknown as Repository<Name>);

  beforeEach(() => jest.clearAllMocks());

  it('finds which words are names, in chunks', async () => {
    repo.find.mockResolvedValue([{ name: 'tom' }]);
    const words = Array.from({ length: 1500 }, (_, i) => `w${i}`);

    await expect(service.findNames(['tom', ...words])).resolves.toEqual(
      new Set(['tom']),
    );
    expect(repo.find).toHaveBeenCalledTimes(2);
  });

  it('lists what a word names, in a fixed order', async () => {
    repo.find.mockResolvedValue([
      { kind: NameKind.CITY },
      { kind: NameKind.PERSON },
    ]);
    await expect(service.kindsOf('London')).resolves.toEqual([
      NameKind.PERSON,
      NameKind.CITY,
    ]);
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'london' } }),
    );
  });
});
