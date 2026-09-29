import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { Book } from '../books/entities/book.entity';
import { Word } from '../books/entities/word.entity';
import { migrations } from '../../migrations';

/**
 * Connection settings shared by the Nest app and the TypeORM CLI
 * (`src/data-source.ts`), so both see the same entities and migrations.
 */
type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

export function dataSourceOptions(): PostgresOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'fictulary',
    password: process.env.DB_PASSWORD ?? 'fictulary',
    database: process.env.DB_NAME ?? 'fictulary',
    entities: [Book, Word],
    migrations,
    // The schema is managed by migrations; never let TypeORM alter it.
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
  };
}

export const databaseConfig = registerAs('database', () => ({
  ...dataSourceOptions(),
  // Apply pending migrations when the app starts.
  migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
}));
