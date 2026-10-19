import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from '@fictulary/shared/models';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Null until the user picks one, when the provider didn't send a name. */
  @Column({ type: 'varchar', length: USER_NAME_MAX_LENGTH, nullable: true })
  name!: string | null;

  /** Stored lowercased, so uniqueness is case-insensitive. */
  @Column({ length: USER_EMAIL_MAX_LENGTH, unique: true })
  email!: string;

  /** When the user answered the knowledge level prompt; null until then. */
  @Column({ type: 'timestamptz', nullable: true })
  levelPromptedAt!: Date | null;
}
