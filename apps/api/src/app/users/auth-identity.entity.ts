import { AuthProvider, USER_EMAIL_MAX_LENGTH } from '@fictulary/shared/models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/** A Google or Apple account a user signs in with. */
@Entity('auth_identities')
@Index(['provider', 'subject'], { unique: true })
export class AuthIdentity {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @Column()
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'enum', enum: AuthProvider })
  provider!: AuthProvider;

  /** The provider's stable user id (the ID token's `sub`). */
  @Column({ length: 255 })
  subject!: string;

  /** Email the provider reported; may be an Apple private relay address. */
  @Column({ length: USER_EMAIL_MAX_LENGTH })
  email!: string;

  /**
   * Apple refresh token, encrypted with `TokenCipher`. Needed to revoke the
   * app's access when the account is deleted.
   */
  @Column({ type: 'text', nullable: true })
  appleRefreshToken!: string | null;

  /** The Apple client id (bundle or Services ID) the token was issued to. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  appleClientId!: string | null;
}
