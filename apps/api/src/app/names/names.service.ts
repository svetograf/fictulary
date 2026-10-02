import { NameKind } from '@fictulary/shared/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Name } from './name.entity';

/** Keeps each query well below Postgres' bind-parameter limit. */
const CHUNK_SIZE = 1000;

@Injectable()
export class NamesService {
  constructor(
    @InjectRepository(Name) private readonly names: Repository<Name>,
  ) {}

  /** The given (lowercase) words that are known names. */
  async findNames(words: Iterable<string>): Promise<Set<string>> {
    const list = [...new Set(words)];
    const found = new Set<string>();
    for (let i = 0; i < list.length; i += CHUNK_SIZE) {
      const rows = await this.names.find({
        select: { name: true },
        where: { name: In(list.slice(i, i + CHUNK_SIZE)) },
      });
      for (const { name } of rows) {
        found.add(name);
      }
    }
    return found;
  }

  /** What the word names, e.g. [PERSON, CITY] for "london"; empty if none. */
  async kindsOf(word: string): Promise<NameKind[]> {
    const rows = await this.names.find({
      select: { kind: true },
      where: { name: word.toLowerCase() },
    });
    const order = Object.values(NameKind);
    return rows
      .map(({ kind }) => kind)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
}
