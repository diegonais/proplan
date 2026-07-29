import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { ResourceCategory } from '../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { TaskDependencyType } from '../../common/enums/task-dependency-type.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { ResourceAssignmentTemporalStatus } from '../resource-assignments/dto/resource-assignment-temporal-status.enum';
import { ResourceAssignment } from '../resource-assignments/entities/resource-assignment.entity';
import { Resource } from '../resources/entities/resource.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../task-dependencies/entities/task-dependency.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { ReportsService } from './reports.service';

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
const outsiderUser = createAuthenticatedUser('55555555-5555-4555-8555-555555555555', UserRole.USER);

describe('ReportsService', () => {
  let projectsRepository: InMemoryProjectsRepository;
  let tasksRepository: InMemoryTasksRepository;
  let dependenciesRepository: InMemoryTaskDependenciesRepository;
  let assignmentsRepository: InMemoryTaskAssignmentsRepository;
  let membersRepository: InMemoryProjectMembersRepository;
  let resourceAssignmentsRepository: InMemoryResourceAssignmentsRepository;
  let service: ReportsService;
  let project: Project;
  let parentTask: Task;
  let childTask: Task;

  beforeEach(() => {
    project = createProject();
    parentTask = createTask({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      startDate: '2026-08-01',
      endDate: '2026-08-05',
    });
    childTask = createTask({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      parentTaskUuid: parentTask.uuid,
      startDate: '2026-08-03',
      endDate: '2026-08-05',
    });
    projectsRepository = new InMemoryProjectsRepository([project]);
    tasksRepository = new InMemoryTasksRepository([parentTask, childTask]);
    dependenciesRepository = new InMemoryTaskDependenciesRepository([
      createDependency(parentTask.uuid, childTask.uuid),
    ]);
    assignmentsRepository = new InMemoryTaskAssignmentsRepository([
      createAssignment(parentTask.uuid, regularUser.uuid, '6.00'),
      createAssignment(childTask.uuid, regularUser.uuid, '2.50'),
    ]);
    membersRepository = new InMemoryProjectMembersRepository([
      createMember(project.uuid, managerUser.uuid),
      createMember(project.uuid, regularUser.uuid),
    ]);
    resourceAssignmentsRepository = new InMemoryResourceAssignmentsRepository([]);
    service = new ReportsService(
      projectsRepository as unknown as Repository<Project>,
      tasksRepository as unknown as Repository<Task>,
      dependenciesRepository as unknown as Repository<TaskDependency>,
      assignmentsRepository as unknown as Repository<TaskAssignment>,
      membersRepository as unknown as Repository<ProjectMember>,
      resourceAssignmentsRepository as unknown as Repository<ResourceAssignment>,
    );
    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000-04:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns Gantt dates unchanged and includes parent child levels and finish to start dependencies', async () => {
    const report = await service.getProjectGantt(project.uuid, adminUser);

    expect(report.projectStartDate).toBe('2026-08-01');
    expect(report.projectEndDate).toBe('2026-08-31');
    expect(report.tasks).toEqual([
      expect.objectContaining({
        uuid: parentTask.uuid,
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        level: 0,
      }),
      expect.objectContaining({
        uuid: childTask.uuid,
        parentTaskUuid: parentTask.uuid,
        startDate: '2026-08-03',
        endDate: '2026-08-05',
        level: 1,
      }),
    ]);
    expect(report.dependencies).toEqual([
      expect.objectContaining({
        predecessorTaskUuid: parentTask.uuid,
        successorTaskUuid: childTask.uuid,
        dependencyType: TaskDependencyType.FINISH_TO_START,
      }),
    ]);
  });

  it('enforces report permissions by role and project membership', async () => {
    await expect(service.getProjectGantt(project.uuid, managerUser)).resolves.toMatchObject({
      projectUuid: project.uuid,
    });
    await expect(service.getProjectGantt(project.uuid, regularUser)).resolves.toMatchObject({
      projectUuid: project.uuid,
    });
    await expect(service.getProjectGantt(project.uuid, outsiderUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getProjectBudget(project.uuid, otherManagerUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('calculates workload as assigned hours by resource', async () => {
    const workload = await service.getProjectWorkload(project.uuid, managerUser);

    expect(workload).toContainEqual(
      expect.objectContaining({
        userUuid: regularUser.uuid,
        assignedHours: '8.50',
      }),
    );
  });

  it('adds only aggregate resource metrics to the dashboard', async () => {
    resourceAssignmentsRepository.setAssignments([
      createResourceAssignment({
        uuid: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        resource: createResource({
          uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
          code: 'LAP-001',
          operationalStatus: ResourceOperationalStatus.OPERATIONAL,
        }),
        startDate: '2026-08-01',
        endDate: '2026-08-10',
      }),
      createResourceAssignment({
        uuid: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
        resource: createResource({
          uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
          code: 'SRV-001',
          operationalStatus: ResourceOperationalStatus.MAINTENANCE,
        }),
        startDate: '2026-07-01',
        endDate: '2026-07-10',
      }),
    ]);

    const dashboard = await service.getDashboard(regularUser);

    expect(dashboard).toMatchObject({
      operationalResources: 1,
      currentlyAssignedResources: 1,
      resourcesInMaintenance: 1,
    });
    expect(dashboard).not.toHaveProperty('resourceUtilization');
  });

  it('returns an empty resource utilization report when the project has no resources', async () => {
    const report = await service.getProjectResourceUtilization(project.uuid, managerUser);

    expect(report.project).toMatchObject({
      uuid: project.uuid,
      name: project.name,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    expect(report.today).toBe('2026-08-03');
    expect(report.summary).toEqual({
      totalAssignedResources: 0,
      activeAssignments: 0,
      scheduledAssignments: 0,
      finishedAssignments: 0,
      resourcesByCategory: [],
    });
    expect(report.assignments).toEqual([]);
  });

  it('reports active scheduled finished task-linked and deleted-resource utilization without human hours', async () => {
    const activeResource = createResource({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      code: 'LAP-001',
      category: ResourceCategory.LAPTOP,
    });
    const futureResource = createResource({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      code: 'LIC-001',
      category: ResourceCategory.SOFTWARE_LICENSE,
    });
    const deletedResource = createResource({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
      code: 'GPS-001',
      category: ResourceCategory.MOBILE_DEVICE,
      deletedAt: new Date('2026-08-02T12:00:00.000Z'),
    });
    resourceAssignmentsRepository.setAssignments([
      createResourceAssignment({
        uuid: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        resource: activeResource,
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        task: parentTask,
        notes: 'Uso autorizado en pruebas.',
      }),
      createResourceAssignment({
        uuid: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
        resource: futureResource,
        startDate: '2026-08-10',
        endDate: '2026-08-12',
      }),
      createResourceAssignment({
        uuid: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
        resource: deletedResource,
        startDate: '2026-08-01',
        endDate: '2026-08-02',
      }),
    ]);

    const report = await service.getProjectResourceUtilization(project.uuid, regularUser);

    expect(report.summary).toMatchObject({
      totalAssignedResources: 3,
      activeAssignments: 1,
      scheduledAssignments: 1,
      finishedAssignments: 1,
    });
    expect(report.summary.resourcesByCategory).toEqual([
      { category: ResourceCategory.LAPTOP, count: 1 },
      { category: ResourceCategory.MOBILE_DEVICE, count: 1 },
      { category: ResourceCategory.SOFTWARE_LICENSE, count: 1 },
    ]);
    expect(report.assignments).toContainEqual(
      expect.objectContaining({
        resourceCode: 'LAP-001',
        temporalStatus: ResourceAssignmentTemporalStatus.ACTIVE,
        assignedDays: 3,
        currentAvailability: 'ASIGNADO',
        authorizedNotes: 'Uso autorizado en pruebas.',
        task: {
          uuid: parentTask.uuid,
          name: parentTask.name,
        },
      }),
    );
    expect(report.assignments).toContainEqual(
      expect.objectContaining({
        resourceCode: 'LIC-001',
        temporalStatus: ResourceAssignmentTemporalStatus.SCHEDULED,
        assignedDays: 3,
        currentAvailability: 'DISPONIBLE',
      }),
    );
    expect(report.assignments).toContainEqual(
      expect.objectContaining({
        resourceCode: 'GPS-001',
        temporalStatus: ResourceAssignmentTemporalStatus.FINISHED,
        currentAvailability: 'ELIMINADO',
      }),
    );
    report.assignments.forEach((assignment) => {
      expect(assignment).not.toHaveProperty('assignedHours');
      expect(assignment).not.toHaveProperty('plannedBudget');
      expect(assignment).not.toHaveProperty('actualCost');
    });
  });

  it('keeps human workload separate from resource assignments', async () => {
    resourceAssignmentsRepository.setAssignments([
      createResourceAssignment({
        resource: createResource({
          uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
          code: 'LAP-001',
        }),
        startDate: '2026-08-01',
        endDate: '2026-08-03',
      }),
    ]);

    const workload = await service.getProjectWorkload(project.uuid, regularUser);

    expect(workload).toEqual([
      expect.objectContaining({
        userUuid: regularUser.uuid,
        assignedHours: '8.50',
      }),
    ]);
  });

  it('rejects resource utilization for users outside the project', async () => {
    await expect(
      service.getProjectResourceUtilization(project.uuid, outsiderUser),
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

function createUser(uuid: string, role: UserRole, name = 'Usuario'): User {
  return {
    uuid,
    email: `${uuid}@proplan.local`,
    name,
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

function createProject(): Project {
  return {
    uuid: '99999999-9999-4999-8999-999999999999',
    name: 'Proyecto reportes',
    description: null,
    objective: 'Validar reportes.',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: ProjectStatus.IN_PROGRESS,
    approvedBudget: '1000.00',
    managerUuid: managerUser.uuid,
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: null,
    manager: createUser(managerUser.uuid, UserRole.PROJECT_MANAGER, 'Jefe'),
    members: [],
    tasks: [],
    resourceAssignments: [],
  };
}

function createTask(overrides: Partial<Task>): Task {
  return {
    uuid: overrides.uuid ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    projectUuid: overrides.projectUuid ?? '99999999-9999-4999-8999-999999999999',
    parentTaskUuid: overrides.parentTaskUuid ?? null,
    name: overrides.name ?? 'Actividad',
    description: null,
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-05',
    status: overrides.status ?? TaskStatus.IN_PROGRESS,
    progress: overrides.progress ?? 25,
    estimatedHours: overrides.estimatedHours ?? '0.00',
    plannedBudget: overrides.plannedBudget ?? '100.00',
    actualCost: overrides.actualCost ?? '50.00',
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: null,
    project: createProject(),
    parentTask: null,
    subtasks: [],
    assignments: [],
    outgoingDependencies: [],
    incomingDependencies: [],
    resourceAssignments: [],
  };
}

function createDependency(predecessorTaskUuid: string, successorTaskUuid: string): TaskDependency {
  return {
    uuid: '77777777-7777-4777-8777-777777777777',
    predecessorTaskUuid,
    successorTaskUuid,
    dependencyType: TaskDependencyType.FINISH_TO_START,
    predecessorTask: createTask({ uuid: predecessorTaskUuid }),
    successorTask: createTask({ uuid: successorTaskUuid }),
  };
}

function createAssignment(
  taskUuid: string,
  userUuid: string,
  assignedHours: string,
): TaskAssignment {
  return {
    uuid: `${taskUuid}-${userUuid}`,
    taskUuid,
    userUuid,
    assignedHours,
    isMainResponsible: false,
    task: createTask({ uuid: taskUuid }),
    user: createUser(userUuid, UserRole.USER, 'Recurso'),
  };
}

function createResource(overrides: Partial<Resource>): Resource {
  return {
    uuid: overrides.uuid ?? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: overrides.name ?? 'Recurso tecnico',
    description: overrides.description ?? null,
    code: overrides.code ?? 'REC-001',
    category: overrides.category ?? ResourceCategory.LAPTOP,
    serialNumber: overrides.serialNumber ?? null,
    operationalStatus: overrides.operationalStatus ?? ResourceOperationalStatus.OPERATIONAL,
    notes: overrides.notes ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: overrides.deletedAt ?? null,
    assignments: [],
  };
}

function createResourceAssignment(overrides: Partial<ResourceAssignment>): ResourceAssignment {
  const resource =
    overrides.resource ??
    createResource({
      uuid: overrides.resourceUuid ?? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

  return {
    uuid: overrides.uuid ?? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    resourceUuid: overrides.resourceUuid ?? resource.uuid,
    projectUuid: overrides.projectUuid ?? '99999999-9999-4999-8999-999999999999',
    taskUuid: overrides.taskUuid ?? overrides.task?.uuid ?? null,
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-03',
    assignedByUuid: overrides.assignedByUuid ?? managerUser.uuid,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: overrides.deletedAt ?? null,
    resource,
    project: overrides.project ?? createProject(),
    task: overrides.task ?? null,
    assignedBy:
      overrides.assignedBy ?? createUser(managerUser.uuid, UserRole.PROJECT_MANAGER, 'Jefe'),
  };
}

function createMember(projectUuid: string, userUuid: string): ProjectMember {
  return {
    uuid: `${projectUuid}-${userUuid}`,
    projectUuid,
    userUuid,
    joinedAt: new Date('2026-07-24T18:30:00.000Z'),
    project: createProject(),
    user: createUser(
      userUuid,
      userUuid === managerUser.uuid ? UserRole.PROJECT_MANAGER : UserRole.USER,
    ),
  };
}

class InMemoryProjectsRepository {
  constructor(private readonly projects: readonly Project[]) {}

  findOne(options: { where: Partial<Project> }): Promise<Project | null> {
    return Promise.resolve(
      this.projects.find(
        (project) => matchesWhere(project, options.where) && project.deletedAt === null,
      ) ?? null,
    );
  }

  createQueryBuilder(): InMemoryProjectsQueryBuilder {
    return new InMemoryProjectsQueryBuilder(this.projects);
  }
}

class InMemoryProjectsQueryBuilder {
  constructor(private readonly projects: readonly Project[]) {}

  leftJoinAndSelect(): this {
    return this;
  }

  orderBy(): this {
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  innerJoin(): this {
    return this;
  }

  andWhere(): this {
    return this;
  }

  getMany(): Promise<Project[]> {
    return Promise.resolve(this.projects.filter((project) => project.deletedAt === null));
  }
}

class InMemoryTasksRepository {
  constructor(private readonly tasks: readonly Task[]) {}

  find(options: { where: Partial<Task>; order?: unknown }): Promise<Task[]> {
    return Promise.resolve(
      this.tasks.filter((task) => matchesWhere(task, options.where) && task.deletedAt === null),
    );
  }
}

class InMemoryTaskDependenciesRepository {
  constructor(private readonly dependencies: readonly TaskDependency[]) {}

  find(options: { where: Partial<TaskDependency>; order?: unknown }): Promise<TaskDependency[]> {
    return Promise.resolve(
      this.dependencies.filter((dependency) => matchesWhere(dependency, options.where)),
    );
  }
}

class InMemoryProjectMembersRepository {
  constructor(private readonly members: readonly ProjectMember[]) {}

  count(options: { where: Partial<ProjectMember> }): Promise<number> {
    return this.find(options).then((members) => members.length);
  }

  find(options: { where: Partial<ProjectMember>; relations?: unknown }): Promise<ProjectMember[]> {
    return Promise.resolve(this.members.filter((member) => matchesWhere(member, options.where)));
  }
}

class InMemoryTaskAssignmentsRepository {
  constructor(private readonly assignments: readonly TaskAssignment[]) {}

  find(options: { where: Partial<TaskAssignment> }): Promise<TaskAssignment[]> {
    return Promise.resolve(
      this.assignments.filter((assignment) => matchesWhere(assignment, options.where)),
    );
  }

  createQueryBuilder(): InMemoryAssignmentQueryBuilder {
    return new InMemoryAssignmentQueryBuilder(this.assignments);
  }
}

class InMemoryResourceAssignmentsRepository {
  constructor(private assignments: readonly ResourceAssignment[]) {}

  setAssignments(assignments: readonly ResourceAssignment[]): void {
    this.assignments = assignments;
  }

  find(options: { where: Partial<ResourceAssignment> }): Promise<ResourceAssignment[]> {
    return Promise.resolve(
      this.assignments.filter(
        (assignment) => assignment.deletedAt === null && matchesWhere(assignment, options.where),
      ),
    );
  }

  createQueryBuilder(): InMemoryResourceAssignmentQueryBuilder {
    return new InMemoryResourceAssignmentQueryBuilder(this.assignments);
  }
}

class InMemoryResourceAssignmentQueryBuilder {
  private projectUuid: string | null = null;

  constructor(private readonly assignments: readonly ResourceAssignment[]) {}

  withDeleted(): this {
    return this;
  }

  innerJoinAndSelect(): this {
    return this;
  }

  leftJoinAndSelect(): this {
    return this;
  }

  where(_condition: string, params: { projectUuid: string }): this {
    this.projectUuid = params.projectUuid;
    return this;
  }

  andWhere(): this {
    return this;
  }

  orderBy(): this {
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  getMany(): Promise<ResourceAssignment[]> {
    return Promise.resolve(
      this.assignments
        .filter(
          (assignment) =>
            assignment.projectUuid === this.projectUuid && assignment.deletedAt === null,
        )
        .sort((firstAssignment, secondAssignment) => {
          const startComparison = firstAssignment.startDate.localeCompare(
            secondAssignment.startDate,
          );

          if (startComparison !== 0) {
            return startComparison;
          }

          const endComparison = firstAssignment.endDate.localeCompare(secondAssignment.endDate);

          return endComparison === 0
            ? firstAssignment.resource.code.localeCompare(secondAssignment.resource.code)
            : endComparison;
        }),
    );
  }
}

class InMemoryAssignmentQueryBuilder {
  private projectUuids: readonly string[] = [];

  constructor(private readonly assignments: readonly TaskAssignment[]) {}

  innerJoin(): this {
    return this;
  }

  select(): this {
    return this;
  }

  addSelect(): this {
    return this;
  }

  where(_condition: string, params: { projectUuids: readonly string[] }): this {
    this.projectUuids = params.projectUuids;
    return this;
  }

  andWhere(): this {
    return this;
  }

  groupBy(): this {
    return this;
  }

  addGroupBy(): this {
    return this;
  }

  orderBy(): this {
    return this;
  }

  getRawMany<T>(): Promise<T[]> {
    const totals = new Map<string, { assignment: TaskAssignment; assignedHours: number }>();

    this.assignments.forEach((assignment) => {
      if (!this.projectUuids.includes(assignment.task.projectUuid)) {
        return;
      }

      const key = `${assignment.task.projectUuid}-${assignment.userUuid}`;
      const current = totals.get(key);
      totals.set(key, {
        assignment,
        assignedHours: (current?.assignedHours ?? 0) + Number(assignment.assignedHours),
      });
    });

    return Promise.resolve(
      Array.from(totals.values()).map(({ assignment, assignedHours }) => ({
        projectUuid: assignment.task.projectUuid,
        userUuid: assignment.userUuid,
        user_uuid: assignment.user.uuid,
        user_name: assignment.user.name,
        user_email: assignment.user.email,
        user_role: assignment.user.role,
        assignedHours: assignedHours.toFixed(2),
      })) as T[],
    );
  }
}

function matchesWhere<T extends object>(entity: T, where: Partial<T>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (isFindOperatorLike(value)) {
      return value._value.includes(entity[key as keyof T]);
    }

    return entity[key as keyof T] === value;
  });
}

function isFindOperatorLike(value: unknown): value is { _value: readonly unknown[] } {
  return (
    typeof value === 'object' && value !== null && '_value' in value && Array.isArray(value._value)
  );
}
