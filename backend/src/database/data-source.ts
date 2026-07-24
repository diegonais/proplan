import 'reflect-metadata';
import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { validateEnvironment } from '../config/env.validation';

config({ path: '../.env' });
config({ path: '.env' });

const environment = validateEnvironment(process.env);

export default new DataSource({
  type: 'postgres',
  host: environment.DB_HOST,
  port: environment.DB_PORT,
  database: environment.DB_NAME,
  username: environment.DB_USERNAME,
  password: environment.DB_PASSWORD,
  synchronize: false,
  migrationsRun: false,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
});
