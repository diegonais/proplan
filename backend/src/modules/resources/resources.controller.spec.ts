import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';

import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ResourceCategory } from '../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

describe('ResourcesController access and validation', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  const create = jest.fn<Promise<unknown>, [CreateResourceDto]>();
  const findAll = jest.fn<Promise<unknown>, [unknown]>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ResourcesController],
      providers: [
        RolesGuard,
        {
          provide: ResourcesService,
          useValue: {
            create,
            findAll,
            findOne: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            remove: jest.fn(),
            checkAvailability: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .compile();

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    create.mockReset();
    findAll.mockReset();
    create.mockResolvedValue({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Laptop Dell',
      code: 'LAP-001',
      category: ResourceCategory.LAPTOP,
      serialNumber: null,
      operationalStatus: ResourceOperationalStatus.OPERATIONAL,
      description: null,
      notes: null,
      isActive: true,
      createdAt: '2026-07-24T18:30:00.000Z',
      updatedAt: '2026-07-24T18:30:00.000Z',
    });
    findAll.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
  });

  it('allows administrators to create resources', async () => {
    await request(httpServer)
      .post('/resources')
      .set('x-test-role', UserRole.ADMIN)
      .send({
        name: 'Laptop Dell',
        code: 'lap-001',
        category: ResourceCategory.LAPTOP,
      })
      .expect(201);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Laptop Dell',
        code: 'LAP-001',
        category: ResourceCategory.LAPTOP,
      }),
    );
  });

  it('prevents project managers from creating catalog resources', async () => {
    await request(httpServer)
      .post('/resources')
      .set('x-test-role', UserRole.PROJECT_MANAGER)
      .send({
        name: 'Laptop Dell',
        code: 'LAP-001',
        category: ResourceCategory.LAPTOP,
      })
      .expect(403);
  });

  it('prevents users from accessing the full institutional catalog', async () => {
    await request(httpServer).get('/resources').set('x-test-role', UserRole.USER).expect(403);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('rejects unknown catalog fields such as isAssigned and quantity', async () => {
    await request(httpServer)
      .post('/resources')
      .set('x-test-role', UserRole.ADMIN)
      .send({
        name: 'Laptop Dell',
        code: 'LAP-001',
        category: ResourceCategory.LAPTOP,
        isAssigned: true,
        quantity: 5,
      })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects invalid resource UUID parameters', async () => {
    await request(httpServer)
      .get('/resources/not-a-uuid')
      .set('x-test-role', UserRole.ADMIN)
      .expect(400);
  });
});

class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();
    const roleHeader = request.headers['x-test-role'];
    const role = parseRole(Array.isArray(roleHeader) ? roleHeader[0] : roleHeader);

    request.user = {
      uuid: '99999999-9999-4999-8999-999999999999',
      name: `Usuario ${role}`,
      email: `${role.toLowerCase()}@proplan.local`,
      role,
      isActive: true,
    };

    return true;
  }
}

function parseRole(value: string | undefined): UserRole {
  if (value === UserRole.ADMIN || value === UserRole.PROJECT_MANAGER || value === UserRole.USER) {
    return value;
  }

  return UserRole.USER;
}
