import { NameKind } from '@fictulary/shared/models';
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Known names of people and places, used to recognize names in uploaded
 * books. Stored lowercase, like book words. Loaded by a migration from
 * migrations/data (see tools/build-names-data.mjs).
 */
@Entity('names')
@Unique(['name', 'kind'])
export class Name {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'enum', enum: NameKind })
  kind!: NameKind;
}
