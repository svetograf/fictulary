import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { bigintTransformer } from '../../common/bigint.transformer';
import { Book } from './book.entity';
import { Word } from './word.entity';

/**
 * Join entity for the many-to-many relation between books and words,
 * carrying how many times the word occurs in the book.
 */
@Entity('book_words')
@Index(['bookId', 'count'])
export class BookWord {
  @PrimaryColumn()
  bookId!: number;

  // bigint ids come back from Postgres as strings.
  @PrimaryColumn({ type: 'bigint' })
  wordId!: string;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  count!: number;

  @ManyToOne(() => Book, (book) => book.bookWords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookId' })
  book!: Book;

  @ManyToOne(() => Word, (word) => word.bookWords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wordId' })
  word!: Word;
}
