import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';

import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProjectStatus } from '../common/enums/project-status.enum';
import { TaskDependencyType } from '../common/enums/task-dependency-type.enum';
import { TaskStatus } from '../common/enums/task-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';
import { FinancesController } from '../modules/finances/finances.controller';
import { FinancesService } from '../modules/finances/finances.service';
import { ProjectMembersController } from '../modules/project-members/project-members.controller';
import { ProjectMembersService } from '../modules/project-members/project-members.service';
import { ProjectsController } from '../modules/projects/projects.controller';
import { ProjectsService } from '../modules/projects/projects.service';
import { ExportsService } from '../modules/reports/exports.service';
import { ReportsController } from '../modules/reports/reports.controller';
import { ReportsService } from '../modules/reports/reports.service';
import { TaskAssignmentsController } from '../modules/task-assignments/task-assignments.controller';
import { TaskAssignmentsService } from '../modules/task-assignments/task-assignments.service';
import { TaskDependenciesController } from '../modules/task-dependencies/task-dependencies.controller';
import { TaskDependenciesService } from '../modules/task-dependencies/task-dependencies.service';
import { TasksController } from '../modules/tasks/tasks.controller';
import { TasksService } from '../modules/tasks/tasks.service';
import { UsersController } from '../modules/users/users.controller';
import { UsersService } from '../modules/users/users.service';

const adminUuid = '10000000-0000-4000-8000-000000000001';
const managerUuid = '10000000-0000-4000-8000-000000000002';
const userUuid = '10000000-0000-4000-8000-000000000003';
const password = 'TemporalPassword123';

describe('academic administrator to export flow (E2E)', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  let store: FlowStore;

  beforeAll(async () => {
    store = new FlowStore();
    const authService = new FlowAuthService(store);
    const usersService = new FlowUsersService(store);
    const projectsService = new FlowProjectsService(store);
    const membersService = new FlowProjectMembersService(store);
    const tasksService = new FlowTasksService(store);
    const dependenciesService = new FlowTaskDependenciesService(store);
    const assignmentsService = new FlowTaskAssignmentsService(store);
    const financesService = new FlowFinancesService(store);
    const reportsService = new FlowReportsService(store);
    const exportsService = new FlowExportsService(store);

    const moduleRef = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        ProjectsController,
        ProjectMembersController,
        TasksController,
        TaskDependenciesController,
        TaskAssignmentsController,
        FinancesController,
        ReportsController,
      ],
      providers: [
        Reflector,
        RolesGuard,
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: ProjectsService, useValue: projectsService },
        { provide: ProjectMembersService, useValue: membersService },
        { provide: TasksService, useValue: tasksService },
        { provide: TaskDependenciesService, useValue: dependenciesService },
        { provide: TaskAssignmentsService, useValue: assignmentsService },
        { provide: FinancesService, useValue: financesService },
        { provide: ReportsService, useValue: reportsService },
        { provide: ExportsService, useValue: exportsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new TokenTestGuard(store))
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

  it('runs the critical project lifecycle from login to PDF and Excel export', async () => {
    const adminLogin = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'admin@proplan.local', password })
      .expect(200);
    const adminToken = readBody(adminLogin).accessToken as string;

    const managerResponse = await request(httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Jefe de proyecto',
        email: 'jefe@proplan.local',
        password,
        role: UserRole.PROJECT_MANAGER,
      })
      .expect(201);
    expect(readBody(managerResponse)).not.toHaveProperty('passwordHash');

    const managerLogin = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'jefe@proplan.local', password })
      .expect(200);
    const managerToken = readBody(managerLogin).accessToken as string;

    const projectResponse = await request(httpServer)
      .post('/projects')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Proyecto academico PROPLAN',
        objective: 'Validar el flujo principal.',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        approvedBudget: '1000.00',
      })
      .expect(201);
    const project = readBody(projectResponse);

    await request(httpServer)
      .post(`/projects/${project.uuid as string}/members`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ userUuid })
      .expect(201);

    const taskResponse = await request(httpServer)
      .post(`/projects/${project.uuid as string}/tasks`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Actividad principal',
        startDate: '2026-08-05',
        endDate: '2026-08-10',
        estimatedHours: 12,
        plannedBudget: '500.00',
      })
      .expect(201);
    const task = readBody(taskResponse);

    const subtaskResponse = await request(httpServer)
      .post(`/projects/${project.uuid as string}/tasks`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Subactividad validada',
        startDate: '2026-08-11',
        endDate: '2026-08-12',
        parentTaskUuid: task.uuid,
      })
      .expect(201);
    const subtask = readBody(subtaskResponse);

    await request(httpServer)
      .post(`/tasks/${subtask.uuid as string}/dependencies`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ predecessorTaskUuid: task.uuid })
      .expect(201);

    await request(httpServer)
      .post(`/tasks/${task.uuid as string}/assignments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ userUuid, assignedHours: 8, isMainResponsible: true })
      .expect(201);

    await request(httpServer)
      .patch(`/tasks/${task.uuid as string}/main-responsible`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ userUuid })
      .expect(200);

    await request(httpServer)
      .patch(`/tasks/${task.uuid as string}/my-progress`)
      .set('Authorization', 'Bearer user-token')
      .send({ status: TaskStatus.IN_PROGRESS, progress: 45 })
      .expect(200);

    await request(httpServer)
      .patch(`/tasks/${task.uuid as string}/financials`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ actualCost: '125.50' })
      .expect(200);

    const statusReport = await request(httpServer)
      .get(`/projects/${project.uuid as string}/reports/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(readBody(statusReport)).toMatchObject({
      projectUuid: project.uuid,
      totalTasks: 2,
    });

    const pdfExport = await request(httpServer)
      .get(`/projects/${project.uuid as string}/exports/pdf`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(pdfExport.headers['content-type']).toContain('application/pdf');
    expect(pdfExport.headers['content-disposition']).toContain('.pdf');

    const excelExport = await request(httpServer)
      .get(`/projects/${project.uuid as string}/exports/excel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(excelExport.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(excelExport.headers['content-disposition']).toContain('.xlsx');
  });

  it('rejects unauthorized user attempts to export complete reports', async () => {
    const project = getProjectOrThrow(store);

    await request(httpServer)
      .get(`/projects/${project.uuid}/exports/pdf`)
      .set('Authorization', 'Bearer user-token')
      .expect(403);
  });
});

class TokenTestGuard implements CanActivate {
  constructor(private readonly store: FlowStore) {}

  canActivate(context: ExecutionContext): boolean {
    const requestContext = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();
    const token = requestContext.headers.authorization?.replace(/^Bearer\s+/i, '');
    const user = this.store.userByToken.get(token ?? '');

    if (user === undefined) {
      return false;
    }

    requestContext.user = user;
    return true;
  }
}

interface FlowUser extends AuthenticatedUser {
  password: string;
}

interface FlowProject {
  uuid: string;
  name: string;
  description: string | null;
  objective: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  approvedBudget: string;
  managerUuid: string;
  manager: SafeUser;
  createdAt: string;
  updatedAt: string;
}

interface FlowTask {
  uuid: string;
  projectUuid: string;
  parentTaskUuid: string | null;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  estimatedHours: string;
  plannedBudget: string | null;
  actualCost: string | null;
}

interface FlowMember {
  uuid: string;
  projectUuid: string;
  userUuid: string;
  user: SafeUser & { isActive: boolean };
  assignedHours: string;
  joinedAt: string;
}

interface FlowAssignment {
  uuid: string;
  taskUuid: string;
  userUuid: string;
  assignedHours: string;
  isMainResponsible: boolean;
  user: SafeUser;
}

interface FlowDependency {
  uuid: string;
  predecessorTaskUuid: string;
  successorTaskUuid: string;
  dependencyType: TaskDependencyType;
  predecessorTask: FlowTask;
  successorTask: FlowTask;
}

interface SafeUser {
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
}

class FlowStore {
  users: FlowUser[] = [
    {
      uuid: adminUuid,
      name: 'Administrador PROPLAN',
      email: 'admin@proplan.local',
      role: UserRole.ADMIN,
      isActive: true,
      password,
    },
    {
      uuid: userUuid,
      name: 'Usuario PROPLAN',
      email: 'usuario@proplan.local',
      role: UserRole.USER,
      isActive: true,
      password,
    },
  ];
  projects: FlowProject[] = [];
  members: FlowMember[] = [];
  tasks: FlowTask[] = [];
  assignments: FlowAssignment[] = [];
  dependencies: FlowDependency[] = [];
  userByToken = new Map<string, AuthenticatedUser>();

  constructor() {
    this.userByToken.set('admin-token', this.toAuthenticatedUser(getUserOrThrow(this, adminUuid)));
    this.userByToken.set('user-token', this.toAuthenticatedUser(getUserOrThrow(this, userUuid)));
  }

  toAuthenticatedUser(user: FlowUser): AuthenticatedUser {
    return {
      uuid: user.uuid,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };
  }
}

class FlowAuthService {
  constructor(private readonly store: FlowStore) {}

  login(input: { email: string; password: string }) {
    const user = this.store.users.find((candidate) => candidate.email === input.email);

    if (user?.password !== input.password) {
      throw new Error('Unexpected login failure in E2E flow.');
    }

    const token = user.role === UserRole.ADMIN ? 'admin-token' : `${user.role.toLowerCase()}-token`;
    this.store.userByToken.set(token, this.store.toAuthenticatedUser(user));

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: '1h',
      user: safeUser(user),
    };
  }
}

class FlowUsersService {
  constructor(private readonly store: FlowStore) {}

  create(input: { name: string; email: string; password: string; role: UserRole }) {
    const user: FlowUser = {
      uuid: input.role === UserRole.PROJECT_MANAGER ? managerUuid : randomUUID(),
      name: input.name,
      email: input.email,
      role: input.role,
      isActive: true,
      password: input.password,
    };
    this.store.users.push(user);
    this.store.userByToken.set('project_manager-token', this.store.toAuthenticatedUser(user));

    return {
      ...safeUser(user),
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }

  findOne(uuid: string) {
    const user = this.store.users.find((candidate) => candidate.uuid === uuid);

    return user === undefined
      ? null
      : {
          ...safeUser(user),
          isActive: user.isActive,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
  }
}

class FlowProjectsService {
  constructor(private readonly store: FlowStore) {}

  create(input: { name: string; objective: string; startDate: string; endDate: string; approvedBudget?: string }, user: AuthenticatedUser) {
    const manager = safeUser(getUserOrThrow(this.store, user.uuid));
    const project: FlowProject = {
      uuid: '20000000-0000-4000-8000-000000000001',
      name: input.name,
      description: null,
      objective: input.objective,
      startDate: input.startDate,
      endDate: input.endDate,
      status: ProjectStatus.PLANNING,
      approvedBudget: input.approvedBudget ?? '0.00',
      managerUuid: user.uuid,
      manager,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.store.projects.push(project);
    this.addMember(project.uuid, user.uuid);

    return project;
  }

  findOne(uuid: string) {
    return this.store.projects.find((project) => project.uuid === uuid) ?? null;
  }

  private addMember(projectUuid: string, userUuid: string): void {
    const user = this.store.users.find((candidate) => candidate.uuid === userUuid);

    if (user !== undefined) {
      this.store.members.push(buildMember(projectUuid, user));
    }
  }
}

class FlowProjectMembersService {
  constructor(private readonly store: FlowStore) {}

  create(projectUuid: string, input: { userUuid: string }) {
    const user = this.store.users.find((candidate) => candidate.uuid === input.userUuid);

    if (user === undefined) {
      throw new Error('Unexpected missing user in E2E flow.');
    }

    const member = buildMember(projectUuid, user);
    this.store.members.push(member);

    return member;
  }

  findAll(projectUuid: string) {
    return this.store.members.filter((member) => member.projectUuid === projectUuid);
  }

  getWorkload(projectUuid: string) {
    return this.findAll(projectUuid).map((member) => ({
      projectUuid,
      userUuid: member.userUuid,
      user: safeUser(member.user),
      assignedHours: sumHours(
        this.store.assignments.filter((assignment) => assignment.userUuid === member.userUuid),
      ),
    }));
  }
}

class FlowTasksService {
  constructor(private readonly store: FlowStore) {}

  create(projectUuid: string, input: Partial<FlowTask>) {
    const task: FlowTask = {
      uuid:
        this.store.tasks.length === 0
          ? '30000000-0000-4000-8000-000000000001'
          : '30000000-0000-4000-8000-000000000002',
      projectUuid,
      parentTaskUuid: input.parentTaskUuid ?? null,
      name: input.name ?? 'Actividad',
      description: input.description ?? null,
      startDate: input.startDate ?? '2026-08-05',
      endDate: input.endDate ?? '2026-08-10',
      status: input.status ?? TaskStatus.PENDING,
      progress: input.progress ?? 0,
      estimatedHours: input.estimatedHours ?? '0.00',
      plannedBudget: input.plannedBudget ?? '0.00',
      actualCost: input.actualCost ?? '0.00',
    };
    this.store.tasks.push(task);

    return task;
  }

  findAll(projectUuid: string) {
    return this.store.tasks.filter((task) => task.projectUuid === projectUuid);
  }

  updateOwnProgress(taskUuid: string, input: { status: TaskStatus; progress: number }) {
    const task = this.store.tasks.find((candidate) => candidate.uuid === taskUuid);

    if (task === undefined) {
      throw new Error('Unexpected missing task in E2E flow.');
    }

    task.status = input.status;
    task.progress = input.progress;

    return task;
  }
}

class FlowTaskDependenciesService {
  constructor(private readonly store: FlowStore) {}

  create(successorTaskUuid: string, input: { predecessorTaskUuid: string }) {
    const predecessorTask = findTask(this.store, input.predecessorTaskUuid);
    const successorTask = findTask(this.store, successorTaskUuid);
    const dependency: FlowDependency = {
      uuid: '40000000-0000-4000-8000-000000000001',
      predecessorTaskUuid: predecessorTask.uuid,
      successorTaskUuid: successorTask.uuid,
      dependencyType: TaskDependencyType.FINISH_TO_START,
      predecessorTask,
      successorTask,
    };
    this.store.dependencies.push(dependency);

    return dependency;
  }
}

class FlowTaskAssignmentsService {
  constructor(private readonly store: FlowStore) {}

  create(taskUuid: string, input: { userUuid: string; assignedHours: number; isMainResponsible?: boolean }) {
    const user = this.store.users.find((candidate) => candidate.uuid === input.userUuid);

    if (user === undefined) {
      throw new Error('Unexpected missing assignee in E2E flow.');
    }

    const assignment: FlowAssignment = {
      uuid: '50000000-0000-4000-8000-000000000001',
      taskUuid,
      userUuid: input.userUuid,
      assignedHours: input.assignedHours.toFixed(2),
      isMainResponsible: input.isMainResponsible ?? false,
      user: safeUser(user),
    };
    this.store.assignments.push(assignment);

    return assignment;
  }

  setMainResponsible(taskUuid: string, userUuid: string) {
    this.store.assignments.forEach((assignment) => {
      if (assignment.taskUuid === taskUuid) {
        assignment.isMainResponsible = assignment.userUuid === userUuid;
      }
    });

    return this.store.assignments.find(
      (assignment) => assignment.taskUuid === taskUuid && assignment.userUuid === userUuid,
    );
  }
}

class FlowFinancesService {
  constructor(private readonly store: FlowStore) {}

  updateTaskFinancials(taskUuid: string, input: { plannedBudget?: string; actualCost?: string }) {
    const task = findTask(this.store, taskUuid);
    task.plannedBudget = input.plannedBudget ?? task.plannedBudget;
    task.actualCost = input.actualCost ?? task.actualCost;

    return task;
  }
}

class FlowReportsService {
  constructor(private readonly store: FlowStore) {}

  getProjectStatus(projectUuid: string) {
    const project = this.store.projects.find((candidate) => candidate.uuid === projectUuid);
    const tasks = this.store.tasks.filter((task) => task.projectUuid === projectUuid);

    return {
      projectUuid,
      projectName: project?.name ?? 'Proyecto',
      projectStatus: project?.status ?? ProjectStatus.PLANNING,
      startDate: project?.startDate ?? '2026-08-01',
      endDate: project?.endDate ?? '2026-08-31',
      progressPercentage: '22.50',
      totalTasks: tasks.length,
      activeNonCancelledTasks: tasks.length,
      taskStatusCounts: Object.values(TaskStatus).map((status) => ({ status, count: 0 })),
      trafficLight: {
        color: 'GREEN',
        reasons: ['Flujo academico validado.'],
        today: '2026-08-15',
        totalActualCost: '125.50',
        approvedBudget: project?.approvedBudget ?? '0.00',
        consumedPercentage: '12.55',
        overdueTasksPercentage: '0.00',
        overdueTasksCount: 0,
        activeNonCancelledTasksCount: tasks.length,
        isProjectOverdue: false,
        overdueTasks: [],
        canViewFinancialDetails: true,
      },
    };
  }

  getProjectGantt(projectUuid: string) {
    const project = this.store.projects.find((candidate) => candidate.uuid === projectUuid);
    const tasks = this.store.tasks.filter((task) => task.projectUuid === projectUuid);

    return {
      projectUuid,
      projectName: project?.name ?? 'Proyecto',
      projectStartDate: project?.startDate ?? '2026-08-01',
      projectEndDate: project?.endDate ?? '2026-08-31',
      datePolicy: 'Las fechas se exponen como YYYY-MM-DD sin conversion de zona horaria.',
      tasks: tasks.map((task) => ({ ...task, level: task.parentTaskUuid === null ? 0 : 1 })),
      dependencies: this.store.dependencies.map((dependency) => ({
        uuid: dependency.uuid,
        predecessorTaskUuid: dependency.predecessorTaskUuid,
        successorTaskUuid: dependency.successorTaskUuid,
        dependencyType: dependency.dependencyType,
      })),
    };
  }

  getProjectWorkload(projectUuid: string) {
    return new FlowProjectMembersService(this.store).getWorkload(projectUuid);
  }

  getProjectBudget(projectUuid: string) {
    const project = this.store.projects.find((candidate) => candidate.uuid === projectUuid);

    return {
      projectUuid,
      approvedBudget: project?.approvedBudget ?? '0.00',
      distributedBudget: '500.00',
      totalActualCost: '125.50',
      balance: '874.50',
      variance: '874.50',
      consumedPercentage: '12.55',
      distributedBudgetDifference: '-500.00',
      budgetExceeded: false,
      operationalBudgetPolicy: 'Se excluyen actividades CANCELLED.',
      tasks: this.store.tasks,
    };
  }
}

class FlowExportsService {
  constructor(private readonly store: FlowStore) {}

  generateProjectPdf(projectUuid: string) {
    return {
      buffer: Buffer.from(`PDF ${projectUuid}`),
      contentType: 'application/pdf',
      fileName: `proplan-${this.safeName(projectUuid)}.pdf`,
    };
  }

  generateProjectExcel(projectUuid: string) {
    return {
      buffer: Buffer.from(`XLSX ${projectUuid}`),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `proplan-${this.safeName(projectUuid)}.xlsx`,
    };
  }

  private safeName(projectUuid: string): string {
    return this.store.projects.find((project) => project.uuid === projectUuid)?.uuid.slice(0, 8) ?? 'proyecto';
  }
}

function buildMember(projectUuid: string, user: FlowUser): FlowMember {
  return {
    uuid: randomUUID(),
    projectUuid,
    userUuid: user.uuid,
    user: {
      ...safeUser(user),
      isActive: user.isActive,
    },
    assignedHours: '0.00',
    joinedAt: nowIso(),
  };
}

function getUserOrThrow(store: FlowStore, userUuid: string): FlowUser {
  const user = store.users.find((candidate) => candidate.uuid === userUuid);

  if (user === undefined) {
    throw new Error('Unexpected missing user in E2E flow.');
  }

  return user;
}

function getProjectOrThrow(store: FlowStore): FlowProject {
  const project = store.projects[0];

  if (project === undefined) {
    throw new Error('Unexpected missing project in E2E flow.');
  }

  return project;
}

function findTask(store: FlowStore, taskUuid: string): FlowTask {
  const task = store.tasks.find((candidate) => candidate.uuid === taskUuid);

  if (task === undefined) {
    throw new Error('Unexpected missing task in E2E flow.');
  }

  return task;
}

function safeUser(user: Pick<FlowUser, 'uuid' | 'name' | 'email' | 'role'>): SafeUser {
  return {
    uuid: user.uuid,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function sumHours(assignments: FlowAssignment[]): string {
  return assignments
    .reduce((total, assignment) => total + Number(assignment.assignedHours), 0)
    .toFixed(2);
}

function nowIso(): string {
  return '2026-07-24T18:30:00.000Z';
}

function readBody(response: request.Response): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}
