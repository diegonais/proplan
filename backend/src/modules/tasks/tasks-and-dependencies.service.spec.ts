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

import { TaskDependencyType } from '../../common/enums/task-dependency-type.enum';
import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../task-dependencies/entities/task-dependency.entity';
import { TaskDependenciesService } from '../task-dependencies/task-dependencies.service';
import { User } from '../users/entities/user.entity';
import { Task } from './entities/task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

const managerUser = createAuthenticatedUser(
  '22222222-2222-4222-8222-222222222222',
  UserRole.PROJECT_MANAGER,
);
const otherManagerUser = createAuthenticatedUser(
  '33333333-3333-4333-8333-333333333333',
  UserRole.PROJECT_MANAGER,
);
const regularUser = createAuthenticatedUser('44444444-4444-4444-8444-444444444444', UserRole.USER);

describe('Tasks and task dependencies rules', () => {
  let projectsRepository: InMemoryProjectsRepository;
  let projectMembersRepository: InMemoryProjectMembersRepository;
  let tasksRepository: InMemoryTasksRepository;
  let taskAssignmentsRepository: InMemoryTaskAssignmentsRepository;
  let taskDependenciesRepository: InMemoryTaskDependenciesRepository;
  let tasksService: TasksService;
  let taskDependenciesService: TaskDependenciesService;
  let project: Project;
  let otherProject: Project;

  beforeEach(() => {
    project = createProject({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      managerUuid: managerUser.uuid,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      approvedBudget: '1000.00',
    });
    otherProject = createProject({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      managerUuid: otherManagerUser.uuid,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    projectsRepository = new InMemoryProjectsRepository([project, otherProject]);
    projectMembersRepository = new InMemoryProjectMembersRepository([
      createProjectMember(project.uuid, regularUser.uuid),
    ]);
    tasksRepository = new InMemoryTasksRepository();
    taskAssignmentsRepository = new InMemoryTaskAssignmentsRepository();
    taskDependenciesRepository = new InMemoryTaskDependenciesRepository(tasksRepository);
    tasksService = new TasksService(
      tasksRepository as unknown as Repository<Task>,
      projectsRepository as unknown as Repository<Project>,
      projectMembersRepository as unknown as Repository<ProjectMember>,
      taskDependenciesRepository as unknown as Repository<TaskDependency>,
      taskAssignmentsRepository as unknown as Repository<TaskAssignment>,
    );
    taskDependenciesService = new TaskDependenciesService(
      taskDependenciesRepository as unknown as Repository<TaskDependency>,
      tasksRepository as unknown as Repository<Task>,
      projectsRepository as unknown as Repository<Project>,
      projectMembersRepository as unknown as Repository<ProjectMember>,
    );
  });

  it('creates an activity inside the project range', async () => {
    await expect(
      tasksService.create(project.uuid, createTaskInput(), managerUser),
    ).resolves.toMatchObject({
      projectUuid: project.uuid,
      name: 'Actividad de analisis',
      startDate: '2026-08-05',
      endDate: '2026-08-10',
    });
  });

  it('rejects activities outside the project range', async () => {
    await expect(
      tasksService.create(
        project.uuid,
        createTaskInput({ startDate: '2026-07-30', endDate: '2026-08-10' }),
        managerUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a subactivity whose parent belongs to another project', async () => {
    const parent = await saveTask(tasksRepository, otherProject.uuid, {
      startDate: '2026-08-02',
      endDate: '2026-08-20',
    });

    await expect(
      tasksService.create(
        project.uuid,
        createTaskInput({ parentTaskUuid: parent.uuid }),
        managerUser,
      ),
    ).rejects.toThrow('mismo proyecto');
  });

  it('rejects a subactivity outside the parent range', async () => {
    const parent = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-04',
      endDate: '2026-08-12',
    });

    await expect(
      tasksService.create(
        project.uuid,
        createTaskInput({
          parentTaskUuid: parent.uuid,
          startDate: '2026-08-03',
          endDate: '2026-08-10',
        }),
        managerUser,
      ),
    ).rejects.toThrow('actividad padre');
  });

  it('rejects parent-child cycles', async () => {
    const parent = await saveTask(tasksRepository, project.uuid);
    const child = await saveTask(tasksRepository, project.uuid, { parentTaskUuid: parent.uuid });

    await expect(
      tasksService.update(parent.uuid, { parentTaskUuid: child.uuid }, managerUser),
    ).rejects.toThrow('ciclos');
  });

  it('rejects COMPLETED without progress 100', async () => {
    await expect(
      tasksService.create(
        project.uuid,
        createTaskInput({ status: TaskStatus.COMPLETED, progress: 80 }),
        managerUser,
      ),
    ).rejects.toThrow('progreso 100');
  });

  it('rejects creating activities when planned budget exceeds the approved project budget', async () => {
    await saveTask(tasksRepository, project.uuid, { plannedBudget: '900.00' });

    await expect(
      tasksService.create(
        project.uuid,
        createTaskInput({ plannedBudget: '101.00' }),
        managerUser,
      ),
    ).rejects.toThrow('presupuesto aprobado');
  });

  it('rejects updating an activity when total planned budget exceeds the approved project budget', async () => {
    const task = await saveTask(tasksRepository, project.uuid, { plannedBudget: '100.00' });
    await saveTask(tasksRepository, project.uuid, { plannedBudget: '850.00' });

    await expect(
      tasksService.update(task.uuid, { plannedBudget: '151.00' }, managerUser),
    ).rejects.toThrow('presupuesto aprobado');
  });

  it('enforces project management permissions by role', async () => {
    await expect(
      tasksService.create(project.uuid, createTaskInput(), otherManagerUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(tasksService.findAll(project.uuid, regularUser)).resolves.toEqual([]);
    await expect(
      tasksService.create(project.uuid, createTaskInput(), regularUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft deletes activities and rejects deletion with active subactivities', async () => {
    const parent = await saveTask(tasksRepository, project.uuid);
    const child = await saveTask(tasksRepository, project.uuid, { parentTaskUuid: parent.uuid });

    await expect(tasksService.remove(parent.uuid, managerUser)).rejects.toThrow(
      'subactividades activas',
    );

    await tasksService.remove(child.uuid, managerUser);

    expect(
      tasksRepository.tasks.find((task) => task.uuid === child.uuid)?.deletedAt,
    ).toBeInstanceOf(Date);
  });

  it('allows assigned users to update only their activity status and progress', async () => {
    const task = await saveTask(tasksRepository, project.uuid);
    taskAssignmentsRepository.assignments.push(createTaskAssignment(task.uuid, regularUser.uuid));

    await expect(
      tasksService.updateOwnProgress(
        task.uuid,
        { status: TaskStatus.IN_PROGRESS, progress: 45 },
        regularUser,
      ),
    ).resolves.toMatchObject({
      uuid: task.uuid,
      status: TaskStatus.IN_PROGRESS,
      progress: 45,
      plannedBudget: null,
      startDate: '2026-08-05',
    });
  });

  it('rejects users updating activity progress when the activity is not assigned to them', async () => {
    const task = await saveTask(tasksRepository, project.uuid);

    await expect(
      tasksService.updateOwnProgress(
        task.uuid,
        { status: TaskStatus.IN_PROGRESS, progress: 45 },
        regularUser,
      ),
    ).rejects.toThrow('ajenas');
  });

  it('rejects self dependencies', async () => {
    const task = await saveTask(tasksRepository, project.uuid);

    await expect(
      taskDependenciesService.create(task.uuid, { predecessorTaskUuid: task.uuid }, managerUser),
    ).rejects.toThrow('si misma');
  });

  it('rejects duplicated dependencies', async () => {
    const predecessor = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-01',
      endDate: '2026-08-05',
    });
    const successor = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-06',
      endDate: '2026-08-10',
    });

    await taskDependenciesService.create(
      successor.uuid,
      { predecessorTaskUuid: predecessor.uuid },
      managerUser,
    );

    await expect(
      taskDependenciesService.create(
        successor.uuid,
        { predecessorTaskUuid: predecessor.uuid },
        managerUser,
      ),
    ).rejects.toThrow('ya existe');
  });

  it('rejects dependencies between different projects', async () => {
    const predecessor = await saveTask(tasksRepository, otherProject.uuid, {
      startDate: '2026-08-01',
      endDate: '2026-08-05',
    });
    const successor = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-06',
      endDate: '2026-08-10',
    });

    await expect(
      taskDependenciesService.create(
        successor.uuid,
        { predecessorTaskUuid: predecessor.uuid },
        managerUser,
      ),
    ).rejects.toThrow('mismo proyecto');
  });

  it('rejects dependency cycles', async () => {
    const firstTask = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-10',
      endDate: '2026-08-10',
    });
    const secondTask = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-10',
      endDate: '2026-08-10',
    });
    const thirdTask = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-10',
      endDate: '2026-08-10',
    });

    await taskDependenciesService.create(
      secondTask.uuid,
      { predecessorTaskUuid: firstTask.uuid },
      managerUser,
    );
    await taskDependenciesService.create(
      thirdTask.uuid,
      { predecessorTaskUuid: secondTask.uuid },
      managerUser,
    );

    await expect(
      taskDependenciesService.create(
        firstTask.uuid,
        { predecessorTaskUuid: thirdTask.uuid },
        managerUser,
      ),
    ).rejects.toThrow('ciclos');
  });

  it('rejects FINISH_TO_START incompatible dates', async () => {
    const predecessor = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    });
    const successor = await saveTask(tasksRepository, project.uuid, {
      startDate: '2026-08-09',
      endDate: '2026-08-12',
    });

    await expect(
      taskDependenciesService.create(
        successor.uuid,
        { predecessorTaskUuid: predecessor.uuid },
        managerUser,
      ),
    ).rejects.toThrow('fin de la predecesora');
  });
});

describe('TasksController restricted user progress endpoint', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  const updateOwnProgress = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: {
            updateOwnProgress,
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user: AuthenticatedUser } };
        }) => {
          context.switchToHttp().getRequest().user = regularUser;
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
    updateOwnProgress.mockReset();
  });

  it('rejects budget and date fields on user progress updates', async () => {
    await request(httpServer)
      .patch('/tasks/77777777-7777-4777-8777-777777777777/my-progress')
      .send({
        status: TaskStatus.IN_PROGRESS,
        progress: 50,
        plannedBudget: 100,
        startDate: '2026-08-06',
      })
      .expect(400);

    expect(updateOwnProgress).not.toHaveBeenCalled();
  });
});

function createTaskInput(overrides: Partial<Parameters<TasksService['create']>[1]> = {}) {
  return {
    name: 'Actividad de analisis',
    description: 'Descripcion breve',
    startDate: '2026-08-05',
    endDate: '2026-08-10',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: 8,
    plannedBudget: '100.00',
    actualCost: '0.00',
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

function createProject(overrides: Partial<Project>): Project {
  const managerUuid = overrides.managerUuid ?? managerUser.uuid;

  return {
    uuid: overrides.uuid ?? randomUUID(),
    name: 'Proyecto PROPLAN',
    description: null,
    objective: 'Planificar el proyecto.',
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-31',
    status: ProjectStatus.PLANNING,
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

function createProjectMember(projectUuid: string, userUuid: string): ProjectMember {
  return {
    uuid: randomUUID(),
    projectUuid,
    userUuid,
    joinedAt: new Date('2026-07-24T18:30:00.000Z'),
    project: createProject({ uuid: projectUuid }),
    user: createUser(userUuid, UserRole.USER),
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

function createTaskAssignment(taskUuid: string, userUuid: string): TaskAssignment {
  return {
    uuid: randomUUID(),
    taskUuid,
    userUuid,
    assignedHours: '0.00',
    isMainResponsible: false,
    task: createTask('', { uuid: taskUuid }),
    user: createUser(userUuid, UserRole.USER),
  };
}

async function saveTask(
  tasksRepository: InMemoryTasksRepository,
  projectUuid: string,
  overrides: Partial<Task> = {},
): Promise<Task> {
  return tasksRepository.save(createTask(projectUuid, overrides));
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
}

class InMemoryProjectMembersRepository {
  constructor(private readonly members: ProjectMember[]) {}

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

  create(input: Partial<Task>): Task {
    return createTask(input.projectUuid ?? '', input);
  }

  save(task: Task): Promise<Task> {
    task.updatedAt = new Date('2026-07-24T18:35:00.000Z');
    const existingIndex = this.tasks.findIndex((candidate) => candidate.uuid === task.uuid);

    if (existingIndex === -1) {
      this.tasks.push(task);
      return Promise.resolve(task);
    }

    this.tasks[existingIndex] = task;
    return Promise.resolve(task);
  }

  findOne(options: { where: Partial<Task> }): Promise<Task | null> {
    return Promise.resolve(
      this.tasks.find(
        (task) =>
          task.deletedAt === null &&
          Object.entries(options.where).every(([key, value]) => task[key as keyof Task] === value),
      ) ?? null,
    );
  }

  find(options: { where: Partial<Task> }): Promise<Task[]> {
    return Promise.resolve(
      this.tasks.filter(
        (task) =>
          task.deletedAt === null &&
          Object.entries(options.where).every(([key, value]) => task[key as keyof Task] === value),
      ),
    );
  }

  count(options: { where: Partial<Task> }): Promise<number> {
    return this.find(options).then((tasks) => tasks.length);
  }

  softRemove(task: Task): Promise<Task> {
    task.deletedAt = new Date('2026-07-24T18:40:00.000Z');
    return Promise.resolve(task);
  }
}

class InMemoryTaskAssignmentsRepository {
  assignments: TaskAssignment[] = [];

  find(options: { where: Partial<TaskAssignment> }): Promise<TaskAssignment[]> {
    return Promise.resolve(
      this.assignments.filter((assignment) =>
        Object.entries(options.where).every(
          ([key, value]) => assignment[key as keyof TaskAssignment] === value,
        ),
      ),
    );
  }

  count(options: { where: Partial<TaskAssignment> }): Promise<number> {
    return this.find(options).then((assignments) => assignments.length);
  }
}

class InMemoryTaskDependenciesRepository {
  dependencies: TaskDependency[] = [];

  constructor(private readonly tasksRepository: InMemoryTasksRepository) {}

  create(input: Partial<TaskDependency>): TaskDependency {
    const predecessorTaskUuid = input.predecessorTaskUuid ?? '';
    const successorTaskUuid = input.successorTaskUuid ?? '';

    return {
      uuid: input.uuid ?? randomUUID(),
      predecessorTaskUuid,
      successorTaskUuid,
      dependencyType: input.dependencyType ?? TaskDependencyType.FINISH_TO_START,
      predecessorTask: input.predecessorTask ?? createTask('', { uuid: predecessorTaskUuid }),
      successorTask: input.successorTask ?? createTask('', { uuid: successorTaskUuid }),
    };
  }

  save(dependency: TaskDependency): Promise<TaskDependency> {
    const predecessorTask = this.tasksRepository.tasks.find(
      (task) => task.uuid === dependency.predecessorTaskUuid,
    );
    const successorTask = this.tasksRepository.tasks.find(
      (task) => task.uuid === dependency.successorTaskUuid,
    );

    if (predecessorTask !== undefined) {
      dependency.predecessorTask = predecessorTask;
    }

    if (successorTask !== undefined) {
      dependency.successorTask = successorTask;
    }

    this.dependencies.push(dependency);
    return Promise.resolve(dependency);
  }

  findOne(options: {
    where: Partial<TaskDependency>;
    relations?: unknown;
  }): Promise<TaskDependency | null> {
    const dependency =
      this.dependencies.find((candidate) =>
        Object.entries(options.where).every(
          ([key, value]) => candidate[key as keyof TaskDependency] === value,
        ),
      ) ?? null;

    return Promise.resolve(dependency === null ? null : this.attachRelations(dependency));
  }

  find(options: {
    where: Partial<TaskDependency>;
    relations?: unknown;
  }): Promise<TaskDependency[]> {
    return Promise.resolve(
      this.dependencies
        .filter((dependency) =>
          Object.entries(options.where).every(
            ([key, value]) => dependency[key as keyof TaskDependency] === value,
          ),
        )
        .map((dependency) => this.attachRelations(dependency)),
    );
  }

  remove(dependency: TaskDependency): Promise<TaskDependency> {
    this.dependencies = this.dependencies.filter((candidate) => candidate.uuid !== dependency.uuid);
    return Promise.resolve(dependency);
  }

  private attachRelations(dependency: TaskDependency): TaskDependency {
    const predecessorTask = this.tasksRepository.tasks.find(
      (task) => task.uuid === dependency.predecessorTaskUuid,
    );
    const successorTask = this.tasksRepository.tasks.find(
      (task) => task.uuid === dependency.successorTaskUuid,
    );

    if (predecessorTask !== undefined) {
      dependency.predecessorTask = predecessorTask;
    }

    if (successorTask !== undefined) {
      dependency.successorTask = successorTask;
    }

    return dependency;
  }
}
