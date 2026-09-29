import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BookWord } from './book-word.entity';

export const WORD_MAX_LENGTH = 255;

/** Dictionary of distinct words, shared by all books. */
@Entity('words')
export class Word {
  // bigint ids come back from Postgres as strings.
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ length: WORD_MAX_LENGTH, unique: true })
  word!: string;

  @OneToMany(() => BookWord, (bookWord) => bookWord.word)
  bookWords!: BookWord[];
}
