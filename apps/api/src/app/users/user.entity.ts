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

  @Column({ length: USER_NAME_MAX_LENGTH })
  name!: string;

  /** Stored lowercased, so uniqueness is case-insensitive. */
  @Column({ length: USER_EMAIL_MAX_LENGTH, unique: true })
  email!: string;

  /** Output of `hashPassword`; never returned by the API. */
  @Column({ length: 255 })
  passwordHash!: string;
}
