import {
  BOOK_DESCRIPTION_MAX_LENGTH,
  BOOK_NAME_MAX_LENGTH,
  CefrLevel,
} from '@fictulary/shared/models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../common/bigint.transformer';
import { User } from '../../users/user.entity';
import { BookWord } from './book-word.entity';

@Entity('books')
// One knowledge-level word list per user.
@Index(['userId'], { unique: true, where: '"level" IS NOT NULL' })
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

  @Column({ type: 'bigint', transformer: bigintTransformer })
  wordCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Set for the user's knowledge-level word list (the CEFR-J words up to this
   * level), null for an uploaded book.
   */
  @Column({ type: 'enum', enum: CefrLevel, nullable: true })
  level!: CefrLevel | null;

  /** The user who uploaded the book; books are private to them. */
  @Index()
  @Column()
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /** Words in this book with their counts (many-to-many via book_words). */
  @OneToMany(() => BookWord, (bookWord) => bookWord.book)
  bookWords!: BookWord[];
}
