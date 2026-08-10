import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { resolveEnvFilePath } from '../config/env-file';

dotenv.config({ path: resolveEnvFilePath() });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: false,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/infrastructure/database/migrations/*.ts'],
});
