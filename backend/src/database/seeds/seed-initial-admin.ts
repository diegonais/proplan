import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { UserRole } from '../../common/enums/user-role.enum';
import { EnvironmentVariables } from '../../config/env.validation';
import { UsersService } from '../../modules/users/users.service';

const logger = new Logger('SeedInitialAdmin');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    const nodeEnvironment = configService.get('NODE_ENV', { infer: true });

    if (nodeEnvironment === 'production') {
      throw new Error('The initial admin seed must not run in production.');
    }

    const email = getRequiredSeedValue(configService, 'INITIAL_ADMIN_EMAIL');
    const name = getRequiredSeedValue(configService, 'INITIAL_ADMIN_NAME');
    const password = getRequiredSeedValue(configService, 'INITIAL_ADMIN_PASSWORD');
    const usersService = app.get(UsersService);
    const createdAdmin = await usersService.createInitialAdmin({
      email,
      name,
      password,
      role: UserRole.ADMIN,
    });

    if (createdAdmin === null) {
      logger.log('Initial administrator already exists. No changes were made.');
      return;
    }

    logger.log(`Initial administrator created for ${createdAdmin.email}.`);
  } finally {
    await app.close();
  }
}

function getRequiredSeedValue(
  configService: ConfigService<EnvironmentVariables, true>,
  key: 'INITIAL_ADMIN_EMAIL' | 'INITIAL_ADMIN_NAME' | 'INITIAL_ADMIN_PASSWORD',
): string {
  const value = configService.get(key, { infer: true });

  if (value === undefined || value.length === 0) {
    throw new Error(`${key} is required to run the initial admin seed.`);
  }

  return value;
}

void bootstrap();
