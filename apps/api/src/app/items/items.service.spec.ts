import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Item } from './item.entity';
import { ItemsService } from './items.service';

describe('ItemsService', () => {
  let service: ItemsService;
  const repo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (item) => ({ id: 'generated', ...item })),
    merge: jest.fn((item, dto) => ({ ...item, ...dto })),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ItemsService,
        { provide: getRepositoryToken(Item), useValue: repo },
      ],
    }).compile();
    service = module.get(ItemsService);
  });

  it('creates an item', async () => {
    await expect(service.create({ name: 'First' })).resolves.toEqual({
      id: 'generated',
      name: 'First',
    });
  });

  it('throws when an item is missing', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when deleting a missing item', async () => {
    repo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
