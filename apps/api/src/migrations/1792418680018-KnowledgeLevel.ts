import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Knowledge levels: `books.level` marks a user's CEFR-J word list (at most
 * one per user), and `users.levelPromptedAt` records that the user answered
 * the level prompt.
 */
export class KnowledgeLevel1792418680018 implements MigrationInterface {
  name = 'KnowledgeLevel1792418680018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "levelPromptedAt" TIMESTAMP WITH TIME ZONE
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."books_level_enum" AS ENUM('A1', 'A2', 'B1', 'B2')
        `);
    await queryRunner.query(`
            ALTER TABLE "books"
            ADD "level" "public"."books_level_enum"
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_6fc483b5cee170992be30a644e" ON "books" ("userId")
            WHERE "level" IS NOT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "public"."IDX_6fc483b5cee170992be30a644e"
        `);
    await queryRunner.query(`
            ALTER TABLE "books" DROP COLUMN "level"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."books_level_enum"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "levelPromptedAt"
        `);
  }
}
