import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Switches sign-in from email/password to Google and Apple:
 * - deletes every user (and, by cascade, their books and dictionaries):
 *   only test accounts existed, and they have no way to sign in anymore;
 * - adds `auth_identities`, the provider accounts each user signs in with;
 * - drops `users.passwordHash` and makes `users.name` optional, since
 *   providers don't always share a name.
 */
export class OAuthIdentities1792056799106 implements MigrationInterface {
  name = 'OAuthIdentities1792056799106';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users"`);
    await queryRunner.query(`
            CREATE TYPE "public"."auth_identities_provider_enum" AS ENUM('GOOGLE', 'APPLE')
        `);
    await queryRunner.query(`
            CREATE TABLE "auth_identities" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "userId" integer NOT NULL,
                "provider" "public"."auth_identities_provider_enum" NOT NULL,
                "subject" character varying(255) NOT NULL,
                "email" character varying(254) NOT NULL,
                "appleRefreshToken" text,
                "appleClientId" character varying(255),
                CONSTRAINT "PK_63a29aebcddd09448dbeee4666b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_6ed26ac7e2276ae145ca68c23a" ON "auth_identities" ("userId")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_c7a2e5804beb9c0a7f13475a14" ON "auth_identities" ("provider", "subject")
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "passwordHash"
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ALTER COLUMN "name" DROP NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "auth_identities"
            ADD CONSTRAINT "FK_6ed26ac7e2276ae145ca68c23af" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Provider-only accounts have no password to restore.
    await queryRunner.query(`DELETE FROM "users"`);
    await queryRunner.query(`
            ALTER TABLE "auth_identities" DROP CONSTRAINT "FK_6ed26ac7e2276ae145ca68c23af"
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ALTER COLUMN "name"
            SET NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD "passwordHash" character varying(255) NOT NULL
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_c7a2e5804beb9c0a7f13475a14"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_6ed26ac7e2276ae145ca68c23a"
        `);
    await queryRunner.query(`
            DROP TABLE "auth_identities"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."auth_identities_provider_enum"
        `);
  }
}
