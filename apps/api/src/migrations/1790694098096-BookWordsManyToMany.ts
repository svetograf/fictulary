import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Turns `words` from one row per (book, word) into a dictionary of distinct
 * words, and moves the per-book counts into the `book_words` join table.
 * Existing counts are preserved in both directions.
 */
export class BookWordsManyToMany1790694098096 implements MigrationInterface {
  name = 'BookWordsManyToMany1790694098096';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "book_words" (
        "bookId" integer NOT NULL,
        "wordId" bigint NOT NULL,
        "count" bigint NOT NULL,
        CONSTRAINT "PK_f5454bf3858a30c8567c1ea5fff" PRIMARY KEY ("bookId", "wordId")
      )
    `);

    // Keep the lowest id of each distinct word as its dictionary entry and
    // point every book's count at it.
    await queryRunner.query(`
      INSERT INTO "book_words" ("bookId", "wordId", "count")
      SELECT w."bookId", d."id", w."count"
      FROM "words" w
      JOIN (SELECT "word", MIN("id") AS "id" FROM "words" GROUP BY "word") d
        ON d."word" = w."word"
    `);
    await queryRunner.query(`
      DELETE FROM "words"
      WHERE "id" NOT IN (SELECT MIN("id") FROM "words" GROUP BY "word")
    `);

    await queryRunner.query(
      `ALTER TABLE "words" DROP CONSTRAINT "FK_b8db4188ffd84f191a255691ba3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e3f60d1585035153ea6d3b8ea7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "words" DROP CONSTRAINT "UQ_c6129a323b3179da3e9dfe9114a"`,
    );
    await queryRunner.query(`ALTER TABLE "words" DROP COLUMN "count"`);
    await queryRunner.query(`ALTER TABLE "words" DROP COLUMN "bookId"`);
    await queryRunner.query(`
      ALTER TABLE "words"
      ADD CONSTRAINT "UQ_38a98e41b6be0f379166dc2b58d" UNIQUE ("word")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_13e7717383424af3ec1147eb7d" ON "book_words" ("bookId", "count")
    `);
    await queryRunner.query(`
      ALTER TABLE "book_words"
      ADD CONSTRAINT "FK_4cf1d3bf60e47d4cea606c3536c" FOREIGN KEY ("bookId")
        REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "book_words"
      ADD CONSTRAINT "FK_a5b52ed52627cf1145398cecd05" FOREIGN KEY ("wordId")
        REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "book_words" DROP CONSTRAINT "FK_a5b52ed52627cf1145398cecd05"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_words" DROP CONSTRAINT "FK_4cf1d3bf60e47d4cea606c3536c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "words" DROP CONSTRAINT "UQ_38a98e41b6be0f379166dc2b58d"`,
    );
    await queryRunner.query(`ALTER TABLE "words" ADD "bookId" integer`);
    await queryRunner.query(`ALTER TABLE "words" ADD "count" bigint`);

    // Expand the dictionary back into one row per (book, word), then remove
    // the dictionary rows themselves.
    await queryRunner.query(`
      INSERT INTO "words" ("word", "bookId", "count")
      SELECT w."word", bw."bookId", bw."count"
      FROM "book_words" bw
      JOIN "words" w ON w."id" = bw."wordId"
    `);
    await queryRunner.query(`DELETE FROM "words" WHERE "bookId" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "words" ALTER COLUMN "bookId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "words" ALTER COLUMN "count" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_13e7717383424af3ec1147eb7d"`,
    );
    await queryRunner.query(`DROP TABLE "book_words"`);
    await queryRunner.query(`
      ALTER TABLE "words"
      ADD CONSTRAINT "UQ_c6129a323b3179da3e9dfe9114a" UNIQUE ("bookId", "word")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_e3f60d1585035153ea6d3b8ea7" ON "words" ("bookId", "count")
    `);
    await queryRunner.query(`
      ALTER TABLE "words"
      ADD CONSTRAINT "FK_b8db4188ffd84f191a255691ba3" FOREIGN KEY ("bookId")
        REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }
}
