import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-user books and dictionaries:
 * - books get an owner (`userId`); existing books go to the oldest user,
 *   or are deleted if there are no users, since nobody could reach them;
 * - `user_words` holds each user's status per word, seeded from their books'
 *   old statuses (Read -> KNOWN, Reading -> LEARNING, Not read -> UNKNOWN,
 *   the best status winning when a word is in several books);
 * - `books.status` is dropped: it only mattered while processing an upload.
 */
export class UserDictionary1790699755830 implements MigrationInterface {
  name = 'UserDictionary1790699755830';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "books" ADD "userId" integer`);
    await queryRunner.query(`
      UPDATE "books" SET "userId" = (SELECT MIN("id") FROM "users")
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."user_words_status_enum" AS ENUM('KNOWN', 'LEARNING', 'UNKNOWN')
    `);
    await queryRunner.query(`
      CREATE TABLE "user_words" (
        "userId" integer NOT NULL,
        "wordId" bigint NOT NULL,
        "status" "public"."user_words_status_enum" NOT NULL DEFAULT 'UNKNOWN',
        CONSTRAINT "PK_4d95335902578b2d6706be8f928" PRIMARY KEY ("userId", "wordId")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "user_words" ("userId", "wordId", "status")
      SELECT b."userId", bw."wordId",
        (ARRAY['KNOWN', 'LEARNING', 'UNKNOWN'])[
          MIN(CASE b."status" WHEN 'READ' THEN 1 WHEN 'READING' THEN 2 ELSE 3 END)
        ]::"public"."user_words_status_enum"
      FROM "books" b
      JOIN "book_words" bw ON bw."bookId" = b."id"
      WHERE b."userId" IS NOT NULL
      GROUP BY b."userId", bw."wordId"
    `);

    // Only possible when there are no users: such books have no owner.
    await queryRunner.query(`DELETE FROM "books" WHERE "userId" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "books" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."books_status_enum"`);

    await queryRunner.query(`
      CREATE INDEX "IDX_bb8627d137a861e2d5dc8d1eb2" ON "books" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_0ca30eb78d26b4e03e577b5ce3" ON "user_words" ("userId", "status")
    `);
    await queryRunner.query(`
      ALTER TABLE "books"
      ADD CONSTRAINT "FK_bb8627d137a861e2d5dc8d1eb20" FOREIGN KEY ("userId")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_words"
      ADD CONSTRAINT "FK_00b5d2a73200f7059d3b4576cfc" FOREIGN KEY ("userId")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_words"
      ADD CONSTRAINT "FK_f7f1412e64794db16bb12b6dff8" FOREIGN KEY ("wordId")
        REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."books_status_enum" AS ENUM('NOT_READ', 'READING', 'READ')
    `);
    await queryRunner.query(`
      ALTER TABLE "books"
      ADD "status" "public"."books_status_enum" NOT NULL DEFAULT 'NOT_READ'
    `);
    // Best effort: a book whose words its owner all knows counts as read.
    await queryRunner.query(`
      UPDATE "books" b SET "status" = 'READ'
      WHERE NOT EXISTS (
        SELECT 1 FROM "book_words" bw
        LEFT JOIN "user_words" uw
          ON uw."wordId" = bw."wordId" AND uw."userId" = b."userId"
        WHERE bw."bookId" = b."id"
          AND (uw."status" IS NULL OR uw."status" <> 'KNOWN')
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "user_words" DROP CONSTRAINT "FK_f7f1412e64794db16bb12b6dff8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_words" DROP CONSTRAINT "FK_00b5d2a73200f7059d3b4576cfc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0ca30eb78d26b4e03e577b5ce3"`,
    );
    await queryRunner.query(`DROP TABLE "user_words"`);
    await queryRunner.query(`DROP TYPE "public"."user_words_status_enum"`);

    await queryRunner.query(
      `ALTER TABLE "books" DROP CONSTRAINT "FK_bb8627d137a861e2d5dc8d1eb20"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb8627d137a861e2d5dc8d1eb2"`,
    );
    await queryRunner.query(`ALTER TABLE "books" DROP COLUMN "userId"`);
  }
}
