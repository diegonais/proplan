import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { GlobalExceptionsFilter } from './common/filters/global-exceptions.filter';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<EnvironmentVariables, true>);

  const apiPrefix = configService.get('API_PREFIX', { infer: true });
  const apiVersion = configService.get('API_VERSION', { infer: true });
  const appPort = configService.get('APP_PORT', { infer: true });
  const corsOrigins = configService.get('CORS_ORIGINS', { infer: true });

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  });

  app.enableCors({
    origin: parseCorsOrigins(corsOrigins),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PROPLAN API')
    .setDescription('Technical API documentation for PROPLAN.')
    .setVersion(apiVersion)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(appPort);
}

function parseCorsOrigins(corsOrigins: string): boolean | string[] {
  if (corsOrigins.trim() === '*') {
    return true;
  }

  return corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

void bootstrap();
