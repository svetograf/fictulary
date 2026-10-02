import { MigrationInterface, QueryRunner } from 'typeorm';
import snapshot from './data/names-v1.json';

/** Rows per INSERT: 2 parameters each, well below Postgres' limit. */
const CHUNK_SIZE = 1000;

/**
 * Creates the names list used to recognize names in uploaded books and
 * loads it from a snapshot of public sources (see
 * tools/build-names-data.mjs for sources and licenses). The snapshot belongs
 * to this migration: refresh the list with a new snapshot and migration.
 */
export class Names1790929028764 implements MigrationInterface {
  name = 'Names1790929028764';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."names_kind_enum" AS ENUM('PERSON', 'CITY', 'COUNTRY', 'LAKE')`,
    );
    await queryRunner.query(`
      CREATE TABLE "names" (
        "id" SERIAL NOT NULL,
        "name" character varying(255) NOT NULL,
        "kind" "public"."names_kind_enum" NOT NULL,
        CONSTRAINT "UQ_3ec51136aaf95f91e69ed189f10" UNIQUE ("name", "kind"),
        CONSTRAINT "PK_d2e97a54ee33765c4d2ff2b8c79" PRIMARY KEY ("id")
      )
    `);

    const rows = Object.entries(snapshot.names).flatMap(([kind, names]) =>
      names.map((name) => [name, kind]),
    );
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const values = chunk
        .map((_, j) => `($${2 * j + 1}, $${2 * j + 2})`)
        .join(', ');
      await queryRunner.query(
        `INSERT INTO "names" ("name", "kind") VALUES ${values}`,
        chunk.flat(),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "names"`);
    await queryRunner.query(`DROP TYPE "public"."names_kind_enum"`);
  }
}
