import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from './item.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
  ) {}

  findAll(): Promise<Item[]> {
    return this.items.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Item> {
    const item = await this.items.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Item ${id} not found`);
    }
    return item;
  }

  create(dto: CreateItemDto): Promise<Item> {
    return this.items.save(this.items.create(dto));
  }

  async update(id: string, dto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(id);
    return this.items.save(this.items.merge(item, dto));
  }

  async remove(id: string): Promise<void> {
    const result = await this.items.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Item ${id} not found`);
    }
  }
}
