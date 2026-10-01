import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the TRASH (typos, truncated words) and NAME (people, places) word
 * statuses. Reverting moves such words back to UNKNOWN.
 */
export class WordStatusTrashName1790860764256 implements MigrationInterface {
  name = 'WordStatusTrashName1790860764256';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Allowed inside the migration's transaction since Postgres 12, as long
    // as the new values aren't used in the same transaction.
    await queryRunner.query(
      `ALTER TYPE "public"."user_words_status_enum" ADD VALUE IF NOT EXISTS 'TRASH'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."user_words_status_enum" ADD VALUE IF NOT EXISTS 'NAME'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enum values can't be dropped: rebuild the type without them.
    await queryRunner.query(
      `UPDATE "user_words" SET "status" = 'UNKNOWN' WHERE "status" IN ('TRASH', 'NAME')`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."user_words_status_enum" RENAME TO "user_words_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_words_status_enum" AS ENUM('KNOWN', 'LEARNING', 'UNKNOWN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_words" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "user_words" ALTER COLUMN "status"
      TYPE "public"."user_words_status_enum"
      USING "status"::text::"public"."user_words_status_enum"
    `);
    await queryRunner.query(
      `ALTER TABLE "user_words" ALTER COLUMN "status" SET DEFAULT 'UNKNOWN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_words_status_enum_old"`);
  }
}
