/**
 * DataSource for the TypeORM CLI. Run it through the Nx targets rather than
 * directly, e.g. `npx nx run api:migration-run`.
 */
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './app/config/database.config';

config({ path: ['apps/api/.env', '.env'], quiet: true });

export default new DataSource(dataSourceOptions());
