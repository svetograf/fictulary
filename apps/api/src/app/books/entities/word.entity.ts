import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { bigintTransformer } from '../../common/bigint.transformer';
import { Book } from './book.entity';

export const WORD_MAX_LENGTH = 255;

@Entity('words')
@Unique(['bookId', 'word'])
@Index(['bookId', 'count'])
export class Word {
  // bigint ids come back from Postgres as strings.
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ length: WORD_MAX_LENGTH })
  word!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  count!: number;

  @Column()
  bookId!: number;

  @ManyToOne(() => Book, (book) => book.words, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookId' })
  book!: Book;
}
