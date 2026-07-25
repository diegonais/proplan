import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { ProjectSortField, SortOrder } from './dto/list-projects-query.dto';
import { Project } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

const adminUser = createAuthenticatedUser('11111111-1111-4111-8111-111111111111', UserRole.ADMIN);
const managerUser = createAuthenticatedUser(
  '22222222-2222-4222-8222-222222222222',
  UserRole.PROJECT_MANAGER,
);
const otherManagerUser = createAuthenticatedUser(
  '33333333-3333-4333-8333-333333333333',
  UserRole.PROJECT_MANAGER,
);
const regularUser = createAuthenticatedUser('44444444-4444-4444-8444-444444444444', UserRole.USER);

describe('ProjectsService', () => {
  let projectsRepository: InMemoryProjectsRepository;
  let usersRepository: InMemoryUsersRepository;
  let projectMembersRepository: InMemoryProjectMembersRepository;
  let tasksRepository: InMemoryTasksRepository;
  let dataSource: InMemoryDataSource;
  let service: ProjectsService;

  beforeEach(() => {
    usersRepository = new InMemoryUsersRepository([
      createUser(adminUser.uuid, UserRole.ADMIN, true, 'Administrador PROPLAN'),
      createUser(managerUser.uuid, UserRole.PROJECT_MANAGER, true, 'Jefe PROPLAN'),
      createUser(otherManagerUser.uuid, UserRole.PROJECT_MANAGER, true, 'Jefe Alterno'),
      createUser(regularUser.uuid, UserRole.USER, true, 'Usuario PROPLAN'),
      createUser('55555555-5555-4555-8555-555555555555', UserRole.PROJECT_MANAGER, false, 'Jefe Inactivo'),
    ]);
    projectMembersRepository = new InMemoryProjectMembersRepository();
    tasksRepository = new InMemoryTasksRepository();
    projectsRepository = new InMemoryProjectsRepository(usersRepository, projectMembersRepository);
    dataSource = new InMemoryDataSource(projectsRepository, projectMembersRepository);
    service = new ProjectsService(
      projectsRepository as unknown as Repository<Project>,
      usersRepository as unknown as Repository<User>,
      projectMembersRepository as unknown as Repository<ProjectMember>,
      tasksRepository as unknown as Repository<Task>,
      dataSource as unknown as DataSource,
    );
  });

  it('allows administrators to create projects with an active manager', async () => {
    const project = await service.create(
      createProjectInput({ managerUuid: managerUser.uuid, approvedBudget: '1200.00' }),
      adminUser,
    );

    expect(project).toMatchObject({
      name: 'Proyecto ERP',
      managerUuid: managerUser.uuid,
      approvedBudget: '1200.00',
      status: ProjectStatus.PLANNING,
    });
    expect(dataSource.transactionCalls).toBe(1);
    expect(projectMembersRepository.members).toEqual([
      expect.objectContaining({
        projectUuid: project.uuid,
        userUuid: managerUser.uuid,
      }),
    ]);
  });

  it('creates projects for project managers and assigns themselves as manager', async () => {
    const project = await service.create(createProjectInput(), managerUser);

    expect(project.managerUuid).toBe(managerUser.uuid);
    expect(projectMembersRepository.members).toContainEqual(
      expect.objectContaining({
        projectUuid: project.uuid,
        userUuid: managerUser.uuid,
      }),
    );
  });

  it('rejects project creation by regular users', async () => {
    await expect(service.create(createProjectInput(), regularUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('prevents project managers from assigning another manager during creation', async () => {
    await expect(
      service.create(createProjectInput({ managerUuid: otherManagerUser.uuid }), managerUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid date ranges', async () => {
    await expect(
      service.create(
        createProjectInput({
          managerUuid: managerUser.uuid,
          startDate: '2026-09-10',
          endDate: '2026-09-01',
        }),
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inactive managers and users without manager roles', async () => {
    await expect(
      service.create(
        createProjectInput({ managerUuid: '55555555-5555-4555-8555-555555555555' }),
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(createProjectInput({ managerUuid: regularUser.uuid }), adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents project managers from modifying projects owned by another manager', async () => {
    const project = await service.create(createProjectInput({ managerUuid: managerUser.uuid }), adminUser);

    await expect(
      service.update(project.uuid, { name: 'Cambio rechazado' }, otherManagerUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows administrators to update any project and reassign its manager', async () => {
    const project = await service.create(createProjectInput({ managerUuid: managerUser.uuid }), adminUser);

    await expect(
      service.update(project.uuid, { name: 'Proyecto Ajustado', managerUuid: otherManagerUser.uuid }, adminUser),
    ).resolves.toMatchObject({
      name: 'Proyecto Ajustado',
      managerUuid: otherManagerUser.uuid,
    });
    expect(projectMembersRepository.members).toContainEqual(
      expect.objectContaining({
        projectUuid: project.uuid,
        userUuid: otherManagerUser.uuid,
      }),
    );
  });

  it('rejects project date updates that would leave activities outside the project range', async () => {
    const project = await service.create(createProjectInput({ managerUuid: managerUser.uuid }), adminUser);
    tasksRepository.tasks.push(
      createTask({
        projectUuid: project.uuid,
        name: 'Actividad de analisis',
        startDate: '2026-08-10',
        endDate: '2026-08-20',
      }),
    );

    await expect(
      service.update(project.uuid, { endDate: '2026-08-15' }, adminUser),
    ).rejects.toThrow('El proyecto no puede dejar fuera de rango a la actividad "Actividad de analisis".');
  });

  it('soft deletes projects and excludes them from normal listings', async () => {
    const project = await service.create(createProjectInput({ managerUuid: managerUser.uuid }), adminUser);

    await service.remove(project.uuid, adminUser);

    expect(projectsRepository.projects[0]?.deletedAt).toBeInstanceOf(Date);
    await expect(service.findOne(project.uuid, adminUser)).rejects.toThrow('Proyecto no encontrado.');

    const list = await service.findAll(
      { page: 1, limit: 10, orderBy: ProjectSortField.CREATED_AT, order: SortOrder.DESC },
      adminUser,
    );
    expect(list.data).toHaveLength(0);
  });

  it('limits project managers to projects under their responsibility', async () => {
    await service.create(createProjectInput({ managerUuid: managerUser.uuid, name: 'Proyecto Propio' }), adminUser);
    await service.create(
      createProjectInput({ managerUuid: otherManagerUser.uuid, name: 'Proyecto Ajeno' }),
      adminUser,
    );

    const list = await service.findAll(
      { page: 1, limit: 10, orderBy: ProjectSortField.CREATED_AT, order: SortOrder.DESC },
      managerUser,
    );

    expect(list.data.map((project) => project.name)).toEqual(['Proyecto Propio']);
  });
});

describe('ProjectsController UUID validation', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: AuthenticatedUser } } }) => {
          context.switchToHttp().getRequest().user = adminUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
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

  it('rejects invalid project UUID route parameters', async () => {
    await request(httpServer).get('/projects/not-a-uuid').expect(400);
  });
});

function createProjectInput(overrides: Partial<Parameters<ProjectsService['create']>[0]> = {}) {
  return {
    name: 'Proyecto ERP',
    description: 'Descripcion breve',
    objective: 'Centralizar la planificacion.',
    startDate: '2026-08-01',
    endDate: '2026-12-15',
    status: ProjectStatus.PLANNING,
    approvedBudget: '0.00',
    ...overrides,
  };
}

function createAuthenticatedUser(uuid: string, role: UserRole): AuthenticatedUser {
  return {
    uuid,
    email: `${uuid}@proplan.local`,
    name: `Usuario ${role}`,
    role,
    isActive: true,
  };
}

function createUser(uuid: string, role: UserRole, isActive: boolean, name: string): User {
  return {
    uuid,
    email: `${uuid}@proplan.local`,
    name,
    role,
    isActive,
    passwordHash: '',
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    managedProjects: [],
    projectMemberships: [],
    taskAssignments: [],
  };
}

function createUserRelation(): User {
  return createUser(
    '00000000-0000-4000-8000-000000000001',
    UserRole.PROJECT_MANAGER,
    true,
    'Usuario Relacion',
  );
}

function createProjectRelation(): Project {
  return {
    uuid: '00000000-0000-4000-8000-000000000002',
    name: 'Proyecto Relacion',
    description: null,
    objective: 'Relacion para pruebas.',
    startDate: '2026-08-01',
    endDate: '2026-12-15',
    status: ProjectStatus.PLANNING,
    approvedBudget: '0.00',
    managerUuid: '00000000-0000-4000-8000-000000000001',
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: null,
    manager: createUserRelation(),
    members: [],
    tasks: [],
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    uuid: overrides.uuid ?? randomUUID(),
    projectUuid: overrides.projectUuid ?? '00000000-0000-4000-8000-000000000002',
    parentTaskUuid: overrides.parentTaskUuid ?? null,
    name: overrides.name ?? 'Actividad de prueba',
    description: overrides.description ?? null,
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-15',
    status: overrides.status ?? TaskStatus.PENDING,
    progress: overrides.progress ?? 0,
    estimatedHours: overrides.estimatedHours ?? '0.00',
    plannedBudget: overrides.plannedBudget ?? '0.00',
    actualCost: overrides.actualCost ?? '0.00',
    createdAt: overrides.createdAt ?? new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: overrides.deletedAt ?? null,
    project: overrides.project ?? createProjectRelation(),
    parentTask: overrides.parentTask ?? null,
    subtasks: overrides.subtasks ?? [],
    assignments: overrides.assignments ?? [],
    outgoingDependencies: overrides.outgoingDependencies ?? [],
    incomingDependencies: overrides.incomingDependencies ?? [],
  };
}

class InMemoryUsersRepository {
  constructor(private readonly users: User[]) {}

  findOne(options: { where: Partial<User> }): Promise<User | null> {
    return Promise.resolve(
      this.users.find((user) =>
        Object.entries(options.where).every(([key, value]) => user[key as keyof User] === value),
      ) ?? null,
    );
  }
}

class InMemoryProjectMembersRepository {
  members: ProjectMember[] = [];

  create(input: Partial<ProjectMember>): ProjectMember {
    return {
      uuid: input.uuid ?? randomUUID(),
      projectUuid: input.projectUuid ?? '',
      userUuid: input.userUuid ?? '',
      joinedAt: input.joinedAt ?? new Date('2026-07-24T18:30:00.000Z'),
      project: input.project ?? createProjectRelation(),
      user: input.user ?? createUserRelation(),
    };
  }

  save(member: ProjectMember): Promise<ProjectMember> {
    const existingMember = this.members.find(
      (candidate) =>
        candidate.projectUuid === member.projectUuid && candidate.userUuid === member.userUuid,
    );

    if (existingMember === undefined) {
      this.members.push(member);
      return Promise.resolve(member);
    }

    return Promise.resolve(existingMember);
  }

  findOne(options: { where: Partial<ProjectMember> }): Promise<ProjectMember | null> {
    return Promise.resolve(
      this.members.find((member) =>
        Object.entries(options.where).every(
          ([key, value]) => member[key as keyof ProjectMember] === value,
        ),
      ) ?? null,
    );
  }

  count(options: { where: Partial<ProjectMember> }): Promise<number> {
    return Promise.resolve(
      this.members.filter((member) =>
        Object.entries(options.where).every(
          ([key, value]) => member[key as keyof ProjectMember] === value,
        ),
      ).length,
    );
  }
}

class InMemoryTasksRepository {
  tasks: Task[] = [];

  find(options: { where: Partial<Task>; order?: unknown }): Promise<Task[]> {
    return Promise.resolve(
      this.tasks.filter(
        (task) =>
          task.deletedAt === null &&
          Object.entries(options.where).every(([key, value]) => task[key as keyof Task] === value),
      ),
    );
  }
}

class InMemoryProjectsRepository {
  projects: Project[] = [];

  constructor(
    private readonly usersRepository: InMemoryUsersRepository,
    private readonly membersRepository: InMemoryProjectMembersRepository,
  ) {}

  create(input: Partial<Project>): Project {
    return {
      uuid: input.uuid ?? randomUUID(),
      name: input.name ?? '',
      description: input.description ?? null,
      objective: input.objective ?? '',
      startDate: input.startDate ?? '2026-08-01',
      endDate: input.endDate ?? '2026-12-15',
      status: input.status ?? ProjectStatus.PLANNING,
      approvedBudget: input.approvedBudget ?? '0.00',
      managerUuid: input.managerUuid ?? '',
      createdAt: input.createdAt ?? new Date('2026-07-24T18:30:00.000Z'),
      updatedAt: input.updatedAt ?? new Date('2026-07-24T18:30:00.000Z'),
      deletedAt: input.deletedAt ?? null,
      manager: input.manager ?? createUserRelation(),
      members: input.members ?? [],
      tasks: [],
    };
  }

  async save(project: Project): Promise<Project> {
    const manager = await this.usersRepository.findOne({ where: { uuid: project.managerUuid } });
    if (manager === null) {
      throw new Error('Project manager not found in test repository.');
    }

    project.manager = manager;
    project.updatedAt = new Date('2026-07-24T18:35:00.000Z');
    const existingIndex = this.projects.findIndex((candidate) => candidate.uuid === project.uuid);

    if (existingIndex === -1) {
      this.projects.push(project);
      return project;
    }

    this.projects[existingIndex] = project;
    return project;
  }

  async findOne(options: { where: Partial<Project> }): Promise<Project | null> {
    const project =
      this.projects.find(
        (candidate) =>
          candidate.deletedAt === null &&
          Object.entries(options.where).every(
            ([key, value]) => candidate[key as keyof Project] === value,
          ),
      ) ?? null;

    return project === null ? null : this.attachRelations(project);
  }

  async findOneOrFail(options: { where: Partial<Project> }): Promise<Project> {
    const project = await this.findOne(options);

    if (project === null) {
      throw new Error('Project not found in test repository.');
    }

    return project;
  }

  softRemove(project: Project): Promise<Project> {
    project.deletedAt = new Date('2026-07-24T18:40:00.000Z');
    return Promise.resolve(project);
  }

  createQueryBuilder(): InMemoryProjectQueryBuilder {
    return new InMemoryProjectQueryBuilder(this.projects, this.membersRepository);
  }

  private async attachRelations(project: Project): Promise<Project> {
    const manager = await this.usersRepository.findOne({ where: { uuid: project.managerUuid } });
    if (manager === null) {
      throw new Error('Project manager not found in test repository.');
    }

    project.manager = manager;
    project.members = this.membersRepository.members.filter((member) => member.projectUuid === project.uuid);

    return project;
  }
}

class InMemoryProjectQueryBuilder {
  private status?: ProjectStatus;
  private managerUuid?: string;
  private memberUserUuid?: string;
  private offset = 0;
  private amount = 10;

  constructor(
    private readonly projects: Project[],
    private readonly membersRepository: InMemoryProjectMembersRepository,
  ) {}

  leftJoinAndSelect(): this {
    return this;
  }

  innerJoin(): this {
    return this;
  }

  andWhere(condition: unknown, params?: Record<string, unknown>): this {
    const conditionText = typeof condition === 'string' ? condition : '';

    if (conditionText.includes('project.status')) {
      this.status = params?.status as ProjectStatus;
    }

    if (conditionText.includes('project.managerUuid')) {
      this.managerUuid = (params?.managerUuid ?? params?.currentUserUuid) as string;
    }

    if (conditionText.includes('member.userUuid')) {
      this.memberUserUuid = params?.currentUserUuid as string;
    }

    return this;
  }

  orderBy(): this {
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  skip(offset: number): this {
    this.offset = offset;
    return this;
  }

  take(amount: number): this {
    this.amount = amount;
    return this;
  }

  getManyAndCount(): Promise<[Project[], number]> {
    const filteredProjects = this.projects.filter((project) => {
      if (project.deletedAt !== null) {
        return false;
      }

      if (this.status !== undefined && project.status !== this.status) {
        return false;
      }

      if (this.managerUuid !== undefined && project.managerUuid !== this.managerUuid) {
        return false;
      }

      if (
        this.memberUserUuid !== undefined &&
        !this.membersRepository.members.some(
          (member) => member.projectUuid === project.uuid && member.userUuid === this.memberUserUuid,
        )
      ) {
        return false;
      }

      return true;
    });

    return Promise.resolve([
      filteredProjects.slice(this.offset, this.offset + this.amount),
      filteredProjects.length,
    ]);
  }
}

class InMemoryDataSource {
  transactionCalls = 0;

  constructor(
    private readonly projectsRepository: InMemoryProjectsRepository,
    private readonly membersRepository: InMemoryProjectMembersRepository,
  ) {}

  transaction<T>(
    callback: (entityManager: { getRepository: (entity: unknown) => unknown }) => Promise<T>,
  ): Promise<T> {
    this.transactionCalls += 1;

    return callback({
      getRepository: (entity: unknown) => {
        if (entity === Project) {
          return this.projectsRepository;
        }

        if (entity === ProjectMember) {
          return this.membersRepository;
        }

        throw new Error('Unexpected repository requested in transaction.');
      },
    });
  }
}
