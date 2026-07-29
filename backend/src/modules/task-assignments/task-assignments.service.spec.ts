import { ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { ProjectMembersService } from '../project-members/project-members.service';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { TaskAssignment } from './entities/task-assignment.entity';
import { TaskAssignmentsService } from './task-assignments.service';

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
const otherRegularUser = createAuthenticatedUser(
  '55555555-5555-4555-8555-555555555555',
  UserRole.USER,
);
const inactiveUserUuid = '66666666-6666-4666-8666-666666666666';

describe('Project members and task assignments rules', () => {
  let usersRepository: InMemoryUsersRepository;
  let projectsRepository: InMemoryProjectsRepository;
  let membersRepository: InMemoryProjectMembersRepository;
  let tasksRepository: InMemoryTasksRepository;
  let assignmentsRepository: InMemoryTaskAssignmentsRepository;
  let dataSource: InMemoryDataSource;
  let membersService: ProjectMembersService;
  let assignmentsService: TaskAssignmentsService;
  let project: Project;
  let task: Task;

  beforeEach(async () => {
    usersRepository = new InMemoryUsersRepository([
      createUser(adminUser.uuid, UserRole.ADMIN, true, 'Administrador'),
      createUser(managerUser.uuid, UserRole.PROJECT_MANAGER, true, 'Jefe'),
      createUser(otherManagerUser.uuid, UserRole.PROJECT_MANAGER, true, 'Jefe Ajeno'),
      createUser(regularUser.uuid, UserRole.USER, true, 'Usuario Activo'),
      createUser(otherRegularUser.uuid, UserRole.USER, true, 'Usuario Externo'),
      createUser(inactiveUserUuid, UserRole.USER, false, 'Usuario Inactivo'),
    ]);
    project = createProject({ managerUuid: managerUser.uuid });
    projectsRepository = new InMemoryProjectsRepository([project]);
    membersRepository = new InMemoryProjectMembersRepository(usersRepository);
    tasksRepository = new InMemoryTasksRepository(projectsRepository);
    assignmentsRepository = new InMemoryTaskAssignmentsRepository(usersRepository, tasksRepository);
    dataSource = new InMemoryDataSource(assignmentsRepository);
    membersService = new ProjectMembersService(
      membersRepository as unknown as Repository<ProjectMember>,
      projectsRepository as unknown as Repository<Project>,
      usersRepository as unknown as Repository<User>,
      assignmentsRepository as unknown as Repository<TaskAssignment>,
    );
    assignmentsService = new TaskAssignmentsService(
      assignmentsRepository as unknown as Repository<TaskAssignment>,
      tasksRepository as unknown as Repository<Task>,
      projectsRepository as unknown as Repository<Project>,
      membersRepository as unknown as Repository<ProjectMember>,
      usersRepository as unknown as Repository<User>,
      dataSource as unknown as DataSource,
    );

    await membersRepository.save(
      membersRepository.create({ projectUuid: project.uuid, userUuid: managerUser.uuid }),
    );
    await membersRepository.save(
      membersRepository.create({ projectUuid: project.uuid, userUuid: regularUser.uuid }),
    );
    task = await tasksRepository.save(createTask(project.uuid));
  });

  it('rejects duplicated project members', async () => {
    await expect(
      membersService.create(project.uuid, { userUuid: regularUser.uuid }, managerUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects inactive users as project members and task assignees', async () => {
    await expect(
      membersService.create(project.uuid, { userUuid: inactiveUserUuid }, managerUser),
    ).rejects.toThrow('activos');

    await membersRepository.save(
      membersRepository.create({ projectUuid: project.uuid, userUuid: inactiveUserUuid }),
    );

    await expect(
      assignmentsService.create(
        task.uuid,
        { userUuid: inactiveUserUuid, assignedHours: 4 },
        managerUser,
      ),
    ).rejects.toThrow('inactivo');
  });

  it('rejects assigning users who are not project members', async () => {
    await expect(
      assignmentsService.create(
        task.uuid,
        { userUuid: otherRegularUser.uuid, assignedHours: 4 },
        managerUser,
      ),
    ).rejects.toThrow('pertenecer al proyecto');
  });

  it('rejects duplicated task assignments', async () => {
    await assignmentsService.create(
      task.uuid,
      { userUuid: regularUser.uuid, assignedHours: 8 },
      managerUser,
    );

    await expect(
      assignmentsService.create(
        task.uuid,
        { userUuid: regularUser.uuid, assignedHours: 2 },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps only one main responsible per task and changes it transactionally', async () => {
    await membersRepository.save(
      membersRepository.create({ projectUuid: project.uuid, userUuid: otherRegularUser.uuid }),
    );
    await assignmentsService.create(
      task.uuid,
      { userUuid: regularUser.uuid, assignedHours: 8, isMainResponsible: true },
      managerUser,
    );
    await assignmentsService.create(
      task.uuid,
      { userUuid: otherRegularUser.uuid, assignedHours: 6, isMainResponsible: true },
      managerUser,
    );

    expect(
      assignmentsRepository.assignments.filter((assignment) => assignment.isMainResponsible),
    ).toHaveLength(1);
    expect(
      assignmentsRepository.assignments.find((assignment) => assignment.isMainResponsible)
        ?.userUuid,
    ).toBe(otherRegularUser.uuid);
    expect(dataSource.transactionCalls).toBe(2);

    await assignmentsService.setMainResponsible(task.uuid, regularUser.uuid, managerUser);

    expect(
      assignmentsRepository.assignments.filter((assignment) => assignment.isMainResponsible),
    ).toHaveLength(1);
    expect(
      assignmentsRepository.assignments.find((assignment) => assignment.isMainResponsible)
        ?.userUuid,
    ).toBe(regularUser.uuid);
    expect(dataSource.transactionCalls).toBe(3);
  });

  it('rejects removing a member with active assignments', async () => {
    await assignmentsService.create(
      task.uuid,
      { userUuid: regularUser.uuid, assignedHours: 8 },
      managerUser,
    );

    await expect(
      membersService.remove(project.uuid, regularUser.uuid, managerUser),
    ).rejects.toThrow('asignaciones activas');
  });

  it('calculates workload as the sum of assigned hours', async () => {
    await assignmentsService.create(
      task.uuid,
      { userUuid: regularUser.uuid, assignedHours: 8 },
      managerUser,
    );
    const secondTask = await tasksRepository.save(
      createTask(project.uuid, { name: 'Actividad secundaria' }),
    );
    await assignmentsService.create(
      secondTask.uuid,
      { userUuid: regularUser.uuid, assignedHours: 2.5 },
      managerUser,
    );

    await expect(membersService.getWorkload(project.uuid, managerUser)).resolves.toContainEqual(
      expect.objectContaining({
        userUuid: regularUser.uuid,
        assignedHours: '10.50',
      }),
    );
  });

  it('enforces member management permissions by role', async () => {
    await expect(
      membersService.create(project.uuid, { userUuid: otherRegularUser.uuid }, adminUser),
    ).resolves.toMatchObject({ userUuid: otherRegularUser.uuid });

    await expect(
      membersService.create(project.uuid, { userUuid: inactiveUserUuid }, otherManagerUser),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      membersService.create(project.uuid, { userUuid: inactiveUserUuid }, regularUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces task assignment management permissions by role', async () => {
    await expect(
      assignmentsService.create(
        task.uuid,
        { userUuid: regularUser.uuid, assignedHours: 8 },
        adminUser,
      ),
    ).resolves.toMatchObject({ userUuid: regularUser.uuid });

    await expect(
      assignmentsService.create(
        task.uuid,
        { userUuid: managerUser.uuid, assignedHours: 1 },
        otherManagerUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      assignmentsService.create(
        task.uuid,
        { userUuid: managerUser.uuid, assignedHours: 1 },
        regularUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
    resourceAssignmentsCreated: [],
  };
}

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    uuid: overrides.uuid ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: overrides.name ?? 'Proyecto PROPLAN',
    description: null,
    objective: 'Planificar el proyecto.',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: ProjectStatus.PLANNING,
    approvedBudget: '0.00',
    managerUuid: overrides.managerUuid ?? managerUser.uuid,
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: null,
    manager: createUser(
      overrides.managerUuid ?? managerUser.uuid,
      UserRole.PROJECT_MANAGER,
      true,
      'Jefe',
    ),
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
    parentTask: null,
    subtasks: [],
    assignments: [],
    outgoingDependencies: [],
    incomingDependencies: [],
    resourceAssignments: [],
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

  find(options: { where?: Partial<User>; order?: unknown }): Promise<User[]> {
    return Promise.resolve(
      this.users
        .filter((user) =>
          Object.entries(options.where ?? {}).every(
            ([key, value]) => user[key as keyof User] === value,
          ),
        )
        .sort((firstUser, secondUser) => firstUser.name.localeCompare(secondUser.name)),
    );
  }
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
  members: ProjectMember[] = [];

  constructor(private readonly usersRepository: InMemoryUsersRepository) {}

  create(input: Partial<ProjectMember>): ProjectMember {
    return {
      uuid: input.uuid ?? randomUUID(),
      projectUuid: input.projectUuid ?? '',
      userUuid: input.userUuid ?? '',
      joinedAt: input.joinedAt ?? new Date('2026-07-24T18:30:00.000Z'),
      project: input.project ?? createProject({ uuid: input.projectUuid }),
      user: input.user ?? createUser(input.userUuid ?? '', UserRole.USER, true, 'Usuario'),
    };
  }

  async save(member: ProjectMember): Promise<ProjectMember> {
    const existingMember = this.members.find(
      (candidate) =>
        candidate.projectUuid === member.projectUuid && candidate.userUuid === member.userUuid,
    );

    if (existingMember !== undefined) {
      return existingMember;
    }

    const user = await this.usersRepository.findOne({ where: { uuid: member.userUuid } });
    if (user !== null) {
      member.user = user;
    }

    this.members.push(member);
    return member;
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

  find(options: {
    where: Partial<ProjectMember>;
    relations?: unknown;
    order?: unknown;
  }): Promise<ProjectMember[]> {
    return Promise.all(
      this.members
        .filter((member) =>
          Object.entries(options.where).every(
            ([key, value]) => member[key as keyof ProjectMember] === value,
          ),
        )
        .map(async (member) => {
          const user = await this.usersRepository.findOne({ where: { uuid: member.userUuid } });
          if (user !== null) {
            member.user = user;
          }
          return member;
        }),
    );
  }

  count(options: { where: Partial<ProjectMember> }): Promise<number> {
    return this.find(options).then((members) => members.length);
  }

  remove(member: ProjectMember): Promise<ProjectMember> {
    this.members = this.members.filter((candidate) => candidate.uuid !== member.uuid);
    return Promise.resolve(member);
  }
}

class InMemoryTasksRepository {
  tasks: Task[] = [];

  constructor(private readonly projectsRepository: InMemoryProjectsRepository) {}

  async save(task: Task): Promise<Task> {
    const project = await this.projectsRepository.findOne({ where: { uuid: task.projectUuid } });
    if (project !== null) {
      task.project = project;
    }
    this.tasks.push(task);
    return task;
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
}

class InMemoryTaskAssignmentsRepository {
  assignments: TaskAssignment[] = [];

  constructor(
    private readonly usersRepository: InMemoryUsersRepository,
    private readonly tasksRepository: InMemoryTasksRepository,
  ) {}

  create(input: Partial<TaskAssignment>): TaskAssignment {
    return {
      uuid: input.uuid ?? randomUUID(),
      taskUuid: input.taskUuid ?? '',
      userUuid: input.userUuid ?? '',
      assignedHours: input.assignedHours ?? '0.00',
      isMainResponsible: input.isMainResponsible ?? false,
      task: input.task ?? createTask(''),
      user: input.user ?? createUser(input.userUuid ?? '', UserRole.USER, true, 'Usuario'),
    };
  }

  async save(assignment: TaskAssignment): Promise<TaskAssignment> {
    const existingDuplicate = this.assignments.find(
      (candidate) =>
        candidate.uuid !== assignment.uuid &&
        candidate.taskUuid === assignment.taskUuid &&
        candidate.userUuid === assignment.userUuid,
    );

    if (existingDuplicate !== undefined) {
      throw new ConflictException('Duplicated assignment in test repository.');
    }

    await this.attachRelations(assignment);
    const existingIndex = this.assignments.findIndex(
      (candidate) => candidate.uuid === assignment.uuid,
    );

    if (existingIndex === -1) {
      this.assignments.push(assignment);
      return assignment;
    }

    this.assignments[existingIndex] = assignment;
    return assignment;
  }

  async findOne(options: {
    where: Partial<TaskAssignment>;
    relations?: unknown;
  }): Promise<TaskAssignment | null> {
    const assignment =
      this.assignments.find((candidate) =>
        Object.entries(options.where).every(
          ([key, value]) => candidate[key as keyof TaskAssignment] === value,
        ),
      ) ?? null;

    if (assignment === null) {
      return null;
    }

    await this.attachRelations(assignment);
    return assignment;
  }

  find(options: {
    where: Partial<TaskAssignment>;
    relations?: unknown;
    order?: unknown;
  }): Promise<TaskAssignment[]> {
    return Promise.all(
      this.assignments
        .filter((assignment) =>
          Object.entries(options.where).every(
            ([key, value]) => assignment[key as keyof TaskAssignment] === value,
          ),
        )
        .map(async (assignment) => {
          await this.attachRelations(assignment);
          return assignment;
        }),
    );
  }

  count(options: { where: Partial<TaskAssignment> }): Promise<number> {
    return this.find(options).then((assignments) => assignments.length);
  }

  update(where: Partial<TaskAssignment>, patch: Partial<TaskAssignment>): Promise<void> {
    this.assignments.forEach((assignment) => {
      const matches = Object.entries(where).every(
        ([key, value]) => assignment[key as keyof TaskAssignment] === value,
      );

      if (matches) {
        Object.assign(assignment, patch);
      }
    });

    return Promise.resolve();
  }

  remove(assignment: TaskAssignment): Promise<TaskAssignment> {
    this.assignments = this.assignments.filter((candidate) => candidate.uuid !== assignment.uuid);
    return Promise.resolve(assignment);
  }

  createQueryBuilder(): InMemoryAssignmentQueryBuilder {
    return new InMemoryAssignmentQueryBuilder(this.assignments, this.tasksRepository);
  }

  private async attachRelations(assignment: TaskAssignment): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { uuid: assignment.userUuid } });
    const task = await this.tasksRepository.findOne({ where: { uuid: assignment.taskUuid } });

    if (user !== null) {
      assignment.user = user;
    }

    if (task !== null) {
      assignment.task = task;
    }
  }
}

class InMemoryAssignmentQueryBuilder {
  private projectUuid?: string;
  private userUuid?: string;
  private shouldReturnRaw = false;

  constructor(
    private readonly assignments: TaskAssignment[],
    private readonly tasksRepository: InMemoryTasksRepository,
  ) {}

  innerJoinAndSelect(): this {
    return this;
  }

  innerJoin(): this {
    return this;
  }

  select(): this {
    this.shouldReturnRaw = true;
    return this;
  }

  addSelect(): this {
    return this;
  }

  where(_condition: string, params: Record<string, string>): this {
    this.projectUuid = params.projectUuid;
    return this;
  }

  andWhere(condition: string, params?: Record<string, string>): this {
    if (condition.includes('assignment.userUuid')) {
      this.userUuid = params?.userUuid;
    }
    return this;
  }

  orderBy(): this {
    return this;
  }

  groupBy(): this {
    return this;
  }

  async getMany(): Promise<TaskAssignment[]> {
    return this.getFilteredAssignments();
  }

  async getRawMany<T>(): Promise<T[]> {
    const totals = new Map<string, number>();
    const assignments = await this.getFilteredAssignments();

    assignments.forEach((assignment) => {
      totals.set(
        assignment.userUuid,
        (totals.get(assignment.userUuid) ?? 0) + Number(assignment.assignedHours),
      );
    });

    return Array.from(totals.entries()).map(([userUuid, assignedHours]) => ({
      userUuid,
      assignedHours: assignedHours.toFixed(2),
    })) as T[];
  }

  private async getFilteredAssignments(): Promise<TaskAssignment[]> {
    const result: TaskAssignment[] = [];

    for (const assignment of this.assignments) {
      const task = await this.tasksRepository.findOne({ where: { uuid: assignment.taskUuid } });

      if (task === null) {
        continue;
      }

      if (this.projectUuid !== undefined && task.projectUuid !== this.projectUuid) {
        continue;
      }

      if (this.userUuid !== undefined && assignment.userUuid !== this.userUuid) {
        continue;
      }

      assignment.task = task;
      result.push(assignment);
    }

    return result;
  }
}

class InMemoryDataSource {
  transactionCalls = 0;

  constructor(private readonly assignmentsRepository: InMemoryTaskAssignmentsRepository) {}

  transaction<T>(
    callback: (entityManager: { getRepository: (entity: unknown) => unknown }) => Promise<T>,
  ): Promise<T> {
    this.transactionCalls += 1;

    return callback({
      getRepository: (entity: unknown) => {
        if (entity === TaskAssignment) {
          return this.assignmentsRepository;
        }

        throw new Error('Unexpected repository requested in transaction.');
      },
    });
  }
}
