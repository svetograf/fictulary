import {
  DictionaryPage,
  DictionaryWord,
  DictionaryWordDetails,
  WordBookUsage,
  WordStatus,
} from '@fictulary/shared/models';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BookWord } from '../books/entities/book-word.entity';
import { Book } from '../books/entities/book.entity';
import { UserWord } from './user-word.entity';

interface RawDictionaryWord {
  wordId: string;
  word: string;
  status: WordStatus;
  count: string;
  bookCount: string;
}

@Injectable()
export class DictionaryService {
  constructor(private readonly dataSource: DataSource) {}

  /** The user's words in one status, most used across their books first. */
  async list(
    userId: number,
    status: WordStatus,
    page: number,
    pageSize: number,
  ): Promise<DictionaryPage> {
    const [rows, total] = await Promise.all([
      this.entries(userId)
        .andWhere('uw.status = :status', { status })
        .orderBy('SUM(bw.count)', 'DESC')
        .addOrderBy('w.word', 'ASC')
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .getRawMany<RawDictionaryWord>(),
      this.dataSource.getRepository(UserWord).countBy({ userId, status }),
    ]);
    return { items: rows.map(toDictionaryWord), total, page, pageSize };
  }

  /** One word with how often it occurs in each of the user's books. */
  async details(
    userId: number,
    wordId: string,
  ): Promise<DictionaryWordDetails> {
    const [entry, books] = await Promise.all([
      this.entry(userId, wordId),
      this.dataSource
        .getRepository(BookWord)
        .createQueryBuilder('bw')
        .innerJoin(Book, 'b', 'b.id = bw.bookId')
        .select('b.id', 'bookId')
        .addSelect('b.name', 'name')
        .addSelect('bw.count', 'count')
        .where('bw.wordId = :wordId', { wordId })
        .andWhere('b.userId = :userId', { userId })
        .orderBy('bw.count', 'DESC')
        .addOrderBy('b.name', 'ASC')
        .getRawMany<{ bookId: number; name: string; count: string }>(),
    ]);
    const usage: WordBookUsage[] = books.map((b) => ({
      bookId: b.bookId,
      name: b.name,
      count: Number(b.count),
    }));
    return { ...entry, books: usage };
  }

  async updateStatus(
    userId: number,
    wordId: string,
    status: WordStatus,
  ): Promise<DictionaryWord> {
    const result = await this.dataSource
      .getRepository(UserWord)
      .update({ userId, wordId }, { status });
    if (!result.affected) {
      throw notInDictionary(wordId);
    }
    return this.entry(userId, wordId);
  }

  /**
   * Records that the user looked the word up: an UNKNOWN word becomes
   * LEARNING; other statuses are left alone.
   */
  async markViewed(userId: number, wordId: string): Promise<DictionaryWord> {
    await this.dataSource
      .getRepository(UserWord)
      .update(
        { userId, wordId, status: WordStatus.UNKNOWN },
        { status: WordStatus.LEARNING },
      );
    return this.entry(userId, wordId);
  }

  private async entry(userId: number, wordId: string): Promise<DictionaryWord> {
    const row = await this.entries(userId)
      .andWhere('uw.wordId = :wordId', { wordId })
      .getRawOne<RawDictionaryWord>();
    if (!row) {
      throw notInDictionary(wordId);
    }
    return toDictionaryWord(row);
  }

  /** User words with their total count across the user's books. */
  private entries(userId: number): SelectQueryBuilder<UserWord> {
    return this.dataSource
      .getRepository(UserWord)
      .createQueryBuilder('uw')
      .innerJoin('uw.word', 'w')
      .innerJoin(BookWord, 'bw', 'bw.wordId = uw.wordId')
      .innerJoin(Book, 'b', 'b.id = bw.bookId AND b.userId = uw.userId')
      .select('uw.wordId', 'wordId')
      .addSelect('w.word', 'word')
      .addSelect('uw.status', 'status')
      .addSelect('SUM(bw.count)', 'count')
      .addSelect('COUNT(bw.bookId)', 'bookCount')
      .where('uw.userId = :userId', { userId })
      .groupBy('uw.wordId')
      .addGroupBy('w.word')
      .addGroupBy('uw.status');
  }
}

// Raw rows skip entity transformers: bigint and COUNT/SUM come back as strings.
function toDictionaryWord(row: RawDictionaryWord): DictionaryWord {
  return {
    wordId: String(row.wordId),
    word: row.word,
    status: row.status,
    count: Number(row.count),
    bookCount: Number(row.bookCount),
  };
}

function notInDictionary(wordId: string): NotFoundException {
  return new NotFoundException(`Word ${wordId} is not in your dictionary`);
}
