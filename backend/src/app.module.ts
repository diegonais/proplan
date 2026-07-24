import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';

import { EnvironmentVariables, validateEnvironment } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TaskDependenciesModule } from './modules/task-dependencies/task-dependencies.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) => ({
        type: 'postgres',
        host: configService.getOrThrow('DB_HOST', { infer: true }),
        port: configService.getOrThrow('DB_PORT', { infer: true }),
        database: configService.getOrThrow('DB_NAME', { infer: true }),
        username: configService.getOrThrow('DB_USERNAME', { infer: true }),
        password: configService.getOrThrow('DB_PASSWORD', { infer: true }),
        synchronize: false,
        migrationsRun: false,
        autoLoadEntities: false,
        entities: [join(__dirname, '**', '*.entity.{ts,js}')],
        migrations: [join(__dirname, 'database', 'migrations', '*{.ts,.js}')],
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    TaskDependenciesModule,
  ],
})
export class AppModule {}
