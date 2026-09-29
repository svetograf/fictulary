import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790692728471 implements MigrationInterface {
  name = 'InitialSchema1790692728471';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "words" (
                "id" BIGSERIAL NOT NULL,
                "word" character varying(255) NOT NULL,
                "count" bigint NOT NULL,
                "bookId" integer NOT NULL,
                CONSTRAINT "UQ_c6129a323b3179da3e9dfe9114a" UNIQUE ("bookId", "word"),
                CONSTRAINT "PK_feaf97accb69a7f355fa6f58a3d" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_e3f60d1585035153ea6d3b8ea7" ON "words" ("bookId", "count")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."books_status_enum" AS ENUM('NOT_READ', 'READING', 'READ')
        `);
    await queryRunner.query(`
            CREATE TABLE "books" (
                "id" SERIAL NOT NULL,
                "name" character varying(1000) NOT NULL,
                "description" character varying(5000),
                "status" "public"."books_status_enum" NOT NULL DEFAULT 'NOT_READ',
                "wordCount" bigint NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_f3f2f25a099d24e12545b70b022" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "words"
            ADD CONSTRAINT "FK_b8db4188ffd84f191a255691ba3" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "words" DROP CONSTRAINT "FK_b8db4188ffd84f191a255691ba3"
        `);
    await queryRunner.query(`
            DROP TABLE "books"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."books_status_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_e3f60d1585035153ea6d3b8ea7"
        `);
    await queryRunner.query(`
            DROP TABLE "words"
        `);
  }
}
