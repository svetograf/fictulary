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
import { Word } from './word.entity';

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

  @OneToMany(() => Word, (word) => word.book)
  words!: Word[];
}
