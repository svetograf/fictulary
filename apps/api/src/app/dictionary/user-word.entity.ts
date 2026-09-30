import { WordStatus } from '@fictulary/shared/models';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Word } from '../books/entities/word.entity';
import { User } from '../users/user.entity';

/** A word in a user's dictionary and how well they know it. */
@Entity('user_words')
@Index(['userId', 'status'])
export class UserWord {
  @PrimaryColumn()
  userId!: number;

  // bigint ids come back from Postgres as strings.
  @PrimaryColumn({ type: 'bigint' })
  wordId!: string;

  @Column({ type: 'enum', enum: WordStatus, default: WordStatus.UNKNOWN })
  status!: WordStatus;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Word, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wordId' })
  word!: Word;
}
