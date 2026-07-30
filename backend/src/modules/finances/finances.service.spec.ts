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
import { Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';

const adminUser = createAuthenticatedUser('11111111-1111-4111-8111-111111111111', UserRole.ADMIN);
const managerUser = createAuthenticatedUser(
  '22222222-2222-4222-8222-222222222222',
  UserRole.PROJECT_MANAGER,
);
const otherManagerUser = createAuthenticatedUser(
  '33333333-3333-4333-8333-333333333333',
  UserRole.PROJECT_MANAGER,
);

describe('FinancesService', () => {
  let projectsRepository: InMemoryProjectsRepository;
  let tasksRepository: InMemoryTasksRepository;
  let service: FinancesService;
  let project: Project;

  beforeEach(() => {
    project = createProject({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      managerUuid: managerUser.uuid,
      approvedBudget: '1000.00',
    });
    projectsRepository = new InMemoryProjectsRepository([project]);
    tasksRepository = new InMemoryTasksRepository();
    service = new FinancesService(
      projectsRepository as unknown as Repository<Project>,
      tasksRepository as unknown as Repository<Task>,
    );
  });

  it('calculates project totals with decimal precision and string serialization', async () => {
    tasksRepository.tasks.push(
      createTask(project.uuid, { plannedBudget: '100.10', actualCost: '50.05' }),
      createTask(project.uuid, { plannedBudget: '200.20', actualCost: '75.15' }),
    );

    const summary = await service.getProjectFinancialSummary(project.uuid, managerUser);

    expect(summary).toMatchObject({
      approvedBudget: '1000.00',
      distributedBudget: '300.30',
      totalActualCost: '125.20',
      balance: '874.80',
      variance: '874.80',
      consumedPercentage: '12.52',
      distributedBudgetDifference: '-699.70',
      budgetExceeded: false,
    });
    expect(
      summary.tasks.some(
        (task) =>
          task.plannedBudget === '100.10' &&
          task.actualCost === '50.05' &&
          task.variance === '50.05' &&
          task.consumedPercentage === '50.00',
      ),
    ).toBe(true);
  });

  it('handles approvedBudget zero without invalid division', async () => {
    project.approvedBudget = '0.00';
    tasksRepository.tasks.push(
      createTask(project.uuid, { plannedBudget: '0.00', actualCost: '10.00' }),
    );

    const summary = await service.getProjectFinancialSummary(project.uuid, adminUser);

    expect(summary.consumedPercentage).toBeNull();
    expect(summary.balance).toBe('-10.00');
    expect(summary.budgetExceeded).toBe(true);
  });

  it('marks the project as exceeded when actual cost is greater than the approved budget', async () => {
    tasksRepository.tasks.push(
      createTask(project.uuid, { plannedBudget: '900.00', actualCost: '1200.01' }),
    );

    await expect(
      service.getProjectFinancialSummary(project.uuid, adminUser),
    ).resolves.toMatchObject({
      totalActualCost: '1200.01',
      balance: '-200.01',
      budgetExceeded: true,
      consumedPercentage: '120.00',
    });
  });

  it('excludes soft deleted and cancelled activities from operational totals', async () => {
    tasksRepository.tasks.push(
      createTask(project.uuid, { plannedBudget: '100.00', actualCost: '80.00' }),
      createTask(project.uuid, {
        plannedBudget: '999.00',
        actualCost: '999.00',
        deletedAt: new Date('2026-07-24T18:40:00.000Z'),
      }),
      createTask(project.uuid, {
        plannedBudget: '500.00',
        actualCost: '300.00',
        status: TaskStatus.CANCELLED,
      }),
    );

    const summary = await service.getProjectFinancialSummary(project.uuid, adminUser);

    expect(summary.distributedBudget).toBe('100.00');
    expect(summary.totalActualCost).toBe('80.00');
    expect(summary.tasks).toHaveLength(1);
    expect(summary.operationalBudgetPolicy).toContain('CANCELLED');
  });

  it('rejects project managers that do not own the project', async () => {
    await expect(
      service.getProjectFinancialSummary(project.uuid, otherManagerUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates project and activity financial fields without accepting calculated totals', async () => {
    const task = createTask(project.uuid);
    tasksRepository.tasks.push(task);

    await expect(
      service.updateProjectBudget(project.uuid, { approvedBudget: '2500.99' }, managerUser),
    ).resolves.toMatchObject({
      approvedBudget: '2500.99',
    });
    await expect(
      service.updateTaskFinancials(
        task.uuid,
        {
          plannedBudget: '700.10',
          actualCost: '701.15',
        },
        managerUser,
      ),
    ).resolves.toMatchObject({
      plannedBudget: '700.10',
      actualCost: '701.15',
    });
  });

  it('rejects financial updates when the project is completed', async () => {
    project.status = ProjectStatus.COMPLETED;
    const task = createTask(project.uuid);
    tasksRepository.tasks.push(task);

    await expect(
      service.updateProjectBudget(project.uuid, { approvedBudget: '2500.99' }, managerUser),
    ).rejects.toThrow('proyecto finalizado');
    await expect(
      service.updateTaskFinancials(task.uuid, { actualCost: '100.00' }, managerUser),
    ).rejects.toThrow('proyecto finalizado');
  });

  it('rejects reducing approved budget below distributed activity budgets', async () => {
    tasksRepository.tasks.push(
      createTask(project.uuid, { plannedBudget: '900.00' }),
      createTask(project.uuid, { plannedBudget: '50.00' }),
    );

    await expect(
      service.updateProjectBudget(project.uuid, { approvedBudget: '949.99' }, managerUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects updating task planned budget above the approved project budget', async () => {
    const task = createTask(project.uuid, { plannedBudget: '100.00' });
    tasksRepository.tasks.push(task, createTask(project.uuid, { plannedBudget: '850.00' }));

    await expect(
      service.updateTaskFinancials(task.uuid, { plannedBudget: '151.00' }, managerUser),
    ).rejects.toThrow('presupuesto aprobado');
  });
});

describe('FinancesController validation', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  const updateProjectBudget = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FinancesController],
      providers: [
        {
          provide: FinancesService,
          useValue: {
            updateProjectBudget,
            getProjectFinancialSummary: jest.fn(),
            updateTaskFinancials: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user: AuthenticatedUser } };
        }) => {
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

  beforeEach(() => {
    updateProjectBudget.mockReset();
  });

  it('rejects negative monetary values before reaching the service', async () => {
    await request(httpServer)
      .patch('/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/budget')
      .send({ approvedBudget: '-1.00' })
      .expect(400);

    expect(updateProjectBudget).not.toHaveBeenCalled();
  });

  it('normalizes accepted monetary strings without converting them to numbers', async () => {
    updateProjectBudget.mockResolvedValue(createProject());

    await request(httpServer)
      .patch('/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/budget')
      .send({ approvedBudget: '9999999999.9' })
      .expect(200);

    expect(updateProjectBudget).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      { approvedBudget: '9999999999.90' },
      adminUser,
    );
  });
});

function createAuthenticatedUser(uuid: string, role: UserRole): AuthenticatedUser {
  return {
    uuid,
    email: `${uuid}@proplan.local`,
    name: `Usuario ${role}`,
    role,
    isActive: true,
  };
}

function createUser(uuid: string, role: UserRole): User {
  return {
    uuid,
    email: `${uuid}@proplan.local`,
    name: `Usuario ${role}`,
    role,
    isActive: true,
    passwordHash: '',
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    managedProjects: [],
    projectMemberships: [],
    taskAssignments: [],
    resourceAssignmentsCreated: [],
  };
}

function createProject(overrides: Partial<Project> = {}): Project {
  const managerUuid = overrides.managerUuid ?? managerUser.uuid;

  return {
    uuid: overrides.uuid ?? randomUUID(),
    name: 'Proyecto PROPLAN',
    description: null,
    objective: 'Planificar el proyecto.',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: overrides.status ?? ProjectStatus.PLANNING,
    approvedBudget: overrides.approvedBudget ?? '0.00',
    managerUuid,
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: null,
    manager: createUser(managerUuid, UserRole.PROJECT_MANAGER),
    members: [],
    tasks: [],
    resourceAssignments: [],
  };
}

function createTask(projectUuid: string, overrides: Partial<Task> = {}): Task {
  return {
    uuid: overrides.uuid ?? randomUUID(),
    projectUuid,
    parentTaskUuid: overrides.parentTaskUuid ?? null,
    name: overrides.name ?? 'Actividad',
    description: overrides.description ?? null,
    startDate: overrides.startDate ?? '2026-08-05',
    endDate: overrides.endDate ?? '2026-08-10',
    status: overrides.status ?? TaskStatus.PENDING,
    progress: overrides.progress ?? 0,
    estimatedHours: overrides.estimatedHours ?? '0.00',
    plannedBudget: overrides.plannedBudget ?? '0.00',
    actualCost: overrides.actualCost ?? '0.00',
    createdAt: overrides.createdAt ?? new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: overrides.deletedAt ?? null,
    project: overrides.project ?? createProject({ uuid: projectUuid }),
    parentTask: overrides.parentTask ?? null,
    subtasks: [],
    assignments: [],
    outgoingDependencies: [],
    incomingDependencies: [],
    resourceAssignments: [],
  };
}

class InMemoryProjectsRepository {
  constructor(private readonly projects: Project[]) {}

  findOne(options: { where: Partial<Project> }): Promise<Project | null> {
    return Promise.resolve(
      this.projects.find(
        (project) =>
          project.deletedAt === null &&
          Object.entries(options.where).every(
            ([key, value]) => project[key as keyof Project] === value,
          ),
      ) ?? null,
    );
  }

  save(project: Project): Promise<Project> {
    project.updatedAt = new Date('2026-07-24T18:35:00.000Z');
    const existingIndex = this.projects.findIndex((candidate) => candidate.uuid === project.uuid);

    if (existingIndex === -1) {
      this.projects.push(project);
    } else {
      this.projects[existingIndex] = project;
    }

    return Promise.resolve(project);
  }
}

class InMemoryTasksRepository {
  tasks: Task[] = [];

  findOne(options: { where: Partial<Task> }): Promise<Task | null> {
    return Promise.resolve(
      this.tasks.find(
        (task) =>
          task.deletedAt === null &&
          Object.entries(options.where).every(([key, value]) => task[key as keyof Task] === value),
      ) ?? null,
    );
  }

  find(options: { where: Partial<Task>; order?: unknown }): Promise<Task[]> {
    return Promise.resolve(
      this.tasks
        .filter(
          (task) =>
            task.deletedAt === null &&
            Object.entries(options.where).every(([key, value]) => {
              if (key === 'status' && typeof value === 'object') {
                return task.status !== TaskStatus.CANCELLED;
              }

              return task[key as keyof Task] === value;
            }),
        )
        .sort((firstTask, secondTask) => {
          const dateComparison = firstTask.startDate.localeCompare(secondTask.startDate);
          return dateComparison === 0
            ? firstTask.name.localeCompare(secondTask.name)
            : dateComparison;
        }),
    );
  }

  save(task: Task): Promise<Task> {
    task.updatedAt = new Date('2026-07-24T18:35:00.000Z');
    const existingIndex = this.tasks.findIndex((candidate) => candidate.uuid === task.uuid);

    if (existingIndex === -1) {
      this.tasks.push(task);
    } else {
      this.tasks[existingIndex] = task;
    }

    return Promise.resolve(task);
  }
}
