import {
  BOOK_DESCRIPTION_MAX_LENGTH,
  BOOK_NAME_MAX_LENGTH,
  BookStatus,
} from '@fictulary/shared/models';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../common/bigint.transformer';
import { BookWord } from './book-word.entity';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: BOOK_NAME_MAX_LENGTH })
  name!: string;

  @Column({
    type: 'varchar',
    length: BOOK_DESCRIPTION_MAX_LENGTH,
    nullable: true,
  })
  description!: string | null;

  @Column({ type: 'enum', enum: BookStatus, default: BookStatus.NOT_READ })
  status!: BookStatus;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  wordCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Words in this book with their counts (many-to-many via book_words). */
  @OneToMany(() => BookWord, (bookWord) => bookWord.book)
  bookWords!: BookWord[];
}
