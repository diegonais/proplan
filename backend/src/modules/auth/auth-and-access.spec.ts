import { Controller, Get, INestApplication, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UsersController } from '../users/users.controller';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtStrategy } from './strategies/jwt.strategy';

const jwtSecret = 'test_secret_with_more_than_32_characters';
const password = 'CorrectPassword123';

@Controller('protected-test')
class ProtectedTestController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminOnly(): { ok: true } {
    return { ok: true };
  }
}

describe('authentication and role access', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;

  const admin = createUser({
    uuid: '11111111-1111-4111-8111-111111111111',
    email: 'admin@proplan.local',
    name: 'Admin PROPLAN',
    role: UserRole.ADMIN,
    isActive: true,
  });
  const regularUser = createUser({
    uuid: '22222222-2222-4222-8222-222222222222',
    email: 'user@proplan.local',
    name: 'Usuario PROPLAN',
    role: UserRole.USER,
    isActive: true,
  });
  const inactiveUser = createUser({
    uuid: '33333333-3333-4333-8333-333333333333',
    email: 'inactive@proplan.local',
    name: 'Usuario Inactivo',
    role: UserRole.USER,
    isActive: false,
  });

  const usersService = {
    findByEmailForAuthentication: jest.fn((email: string): User | null => {
      return [admin, regularUser, inactiveUser].find((user) => user.email === email) ?? null;
    }),
    findActiveByUuidForAuthentication: jest.fn((uuid: string): User | null => {
      return [admin, regularUser].find((user) => user.uuid === uuid && user.isActive) ?? null;
    }),
    findOne: jest.fn((uuid: string) => {
      const user = [admin, regularUser].find((candidate) => candidate.uuid === uuid);

      if (user === undefined) {
        throw new Error('Unexpected user lookup.');
      }

      return {
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };
    }),
    findAll: jest.fn(() => ({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })),
    create: jest.fn(() => ({
      uuid: '44444444-4444-4444-8444-444444444444',
      name: 'Nuevo Usuario',
      email: 'nuevo@proplan.local',
      role: UserRole.USER,
      isActive: true,
      createdAt: new Date('2026-07-24T18:30:00.000Z').toISOString(),
      updatedAt: new Date('2026-07-24T18:30:00.000Z').toISOString(),
    })),
  };

  beforeAll(async () => {
    admin.passwordHash = await bcrypt.hash(password, 10);
    regularUser.passwordHash = await bcrypt.hash(password, 10);
    inactiveUser.passwordHash = await bcrypt.hash(password, 10);

    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController, UsersController, ProtectedTestController],
      providers: [
        AuthService,
        JwtStrategy,
        RolesGuard,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string): string => {
              if (key === 'JWT_SECRET') {
                return jwtSecret;
              }

              if (key === 'JWT_EXPIRES_IN') {
                return '1h';
              }

              return '';
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as SupertestApp;
    jwtService = app.get(JwtService);
    adminToken = await signToken(jwtService, {
      sub: admin.uuid,
      email: admin.email,
      role: admin.role,
    });
    userToken = await signToken(jwtService, {
      sub: regularUser.uuid,
      email: regularUser.email,
      role: regularUser.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts a session with valid email and password', async () => {
    const response = await request(httpServer)
      .post('/auth/login')
      .send({ email: ' ADMIN@PROPLAN.LOCAL ', password })
      .expect(200);
    const body = readResponseBody(response);
    const user = body.user as Record<string, unknown>;

    expect(body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: '1h',
    });
    expect(user).toMatchObject({
      uuid: admin.uuid,
      email: admin.email,
      role: UserRole.ADMIN,
    });
    expect(body.accessToken).toEqual(expect.any(String));
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects incorrect credentials without revealing whether the email exists', async () => {
    const response = await request(httpServer)
      .post('/auth/login')
      .send({ email: admin.email, password: 'WrongPassword123' })
      .expect(401);
    const body = readResponseBody(response);

    expect(body.message).toBe('Credenciales inválidas.');
  });

  it('rejects inactive users during login', async () => {
    const response = await request(httpServer)
      .post('/auth/login')
      .send({ email: inactiveUser.email, password })
      .expect(401);
    const body = readResponseBody(response);

    expect(body.message).toBe('Credenciales inválidas.');
  });

  it('rejects access without token', async () => {
    await request(httpServer).get('/protected-test/me').expect(401);
  });

  it('rejects invalid tokens', async () => {
    await request(httpServer)
      .get('/protected-test/me')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
  });

  it('rejects expired tokens', async () => {
    const expiredToken = await jwtService.signAsync(
      { sub: admin.uuid, email: admin.email, role: admin.role },
      { expiresIn: '-1s' },
    );

    await request(httpServer)
      .get('/protected-test/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('rejects users without enough role for protected administration routes', async () => {
    await request(httpServer)
      .get('/protected-test/admin')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('allows administrators to create users', async () => {
    const response = await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Nuevo Usuario',
        email: 'nuevo@proplan.local',
        password: 'TemporalPassword123',
        role: UserRole.USER,
      })
      .expect(201);
    const body = readResponseBody(response);

    expect(body).toMatchObject({
      uuid: '44444444-4444-4444-8444-444444444444',
      email: 'nuevo@proplan.local',
      role: UserRole.USER,
    });
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('prevents normal users from managing users', async () => {
    await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Otro Usuario',
        email: 'otro@proplan.local',
        password: 'TemporalPassword123',
        role: UserRole.USER,
      })
      .expect(403);
  });
});

function createUser(input: {
  uuid: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}): User {
  return {
    uuid: input.uuid,
    email: input.email,
    name: input.name,
    role: input.role,
    isActive: input.isActive,
    passwordHash: '',
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    managedProjects: [],
    projectMemberships: [],
    taskAssignments: [],
  };
}

function signToken(jwtService: JwtService, payload: JwtPayload): Promise<string> {
  return jwtService.signAsync(payload);
}

function readResponseBody(response: request.Response): Record<string, unknown> {
  const body: unknown = response.body;

  return body as Record<string, unknown>;
}
