import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';

import { EnvironmentVariables, validateEnvironment } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { FinancesModule } from './modules/finances/finances.module';
import { ProjectMembersModule } from './modules/project-members/project-members.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TaskAssignmentsModule } from './modules/task-assignments/task-assignments.module';
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
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.getOrThrow('THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
            limit: configService.getOrThrow('THROTTLE_LIMIT', { infer: true }),
          },
        ],
        errorMessage: 'Demasiadas solicitudes. Intente nuevamente mas tarde.',
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    ProjectMembersModule,
    TasksModule,
    TaskAssignmentsModule,
    TaskDependenciesModule,
    FinancesModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
