import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { ResourceCategory } from '../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { Resource } from '../resources/entities/resource.entity';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { ResourceAssignmentTemporalStatus } from './dto/resource-assignment-temporal-status.enum';
import { ResourceAssignment } from './entities/resource-assignment.entity';
import { ResourceAssignmentsService } from './resource-assignments.service';

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

describe('ResourceAssignmentsService', () => {
  let store: InMemoryStore;
  let service: ResourceAssignmentsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T16:00:00.000Z'));
    store = createBaseStore();
    const dataSource = new InMemoryDataSource(store);
    service = new ResourceAssignmentsService(
      dataSource.resourceAssignmentsRepository as unknown as Repository<ResourceAssignment>,
      dataSource.resourcesRepository as unknown as Repository<Resource>,
      dataSource.projectsRepository as unknown as Repository<Project>,
      dataSource.tasksRepository as unknown as Repository<Task>,
      dataSource as unknown as DataSource,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a project-level resource assignment and registers the authenticated user', async () => {
    const response = await service.create(
      store.mainProject.uuid,
      {
        resourceUuid: store.laptop.uuid,
        startDate: '2026-08-01',
        endDate: '2026-08-05',
      },
      adminUser,
    );

    expect(response).toMatchObject({
      resourceUuid: store.laptop.uuid,
      projectUuid: store.mainProject.uuid,
      taskUuid: null,
      assignedByUuid: adminUser.uuid,
      temporalStatus: ResourceAssignmentTemporalStatus.SCHEDULED,
    });
    expect(store.resourceAssignments).toHaveLength(1);
  });

  it('rejects project managers assigning resources without an activity', async () => {
    await expect(
      service.create(
        store.mainProject.uuid,
        {
          resourceUuid: store.laptop.uuid,
          startDate: '2026-08-01',
          endDate: '2026-08-05',
        },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a task-level resource assignment when the task belongs to the project', async () => {
    await expect(
      service.create(
        store.mainProject.uuid,
        {
          resourceUuid: store.laptop.uuid,
          taskUuid: store.mainTask.uuid,
          startDate: '2026-08-05',
          endDate: '2026-08-10',
        },
        managerUser,
      ),
    ).resolves.toMatchObject({
      taskUuid: store.mainTask.uuid,
      task: { uuid: store.mainTask.uuid, name: store.mainTask.name },
    });
  });

  it('rejects a task from another project', async () => {
    await expect(
      service.create(
        store.mainProject.uuid,
        {
          resourceUuid: store.laptop.uuid,
          taskUuid: store.otherTask.uuid,
          startDate: '2026-08-05',
          endDate: '2026-08-10',
        },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-operational resources', async () => {
    await expect(
      service.create(
        store.mainProject.uuid,
        {
          resourceUuid: store.maintenanceServer.uuid,
          startDate: '2026-08-01',
          endDate: '2026-08-05',
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects dates outside the project range', async () => {
    await expect(
      service.create(
        store.mainProject.uuid,
        {
          resourceUuid: store.laptop.uuid,
          startDate: '2026-07-27',
          endDate: '2026-08-02',
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects dates outside the task range', async () => {
    await expect(
      service.create(
        store.mainProject.uuid,
        {
          resourceUuid: store.laptop.uuid,
          taskUuid: store.mainTask.uuid,
          startDate: '2026-08-04',
          endDate: '2026-08-06',
        },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects total, partial and same-day overlaps', async () => {
    seedAssignment(store, { resourceUuid: store.laptop.uuid, startDate: '2026-08-01', endDate: '2026-08-10' });

    await expect(
      service.create(
        store.mainProject.uuid,
        { resourceUuid: store.laptop.uuid, startDate: '2026-08-01', endDate: '2026-08-10' },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.create(
        store.mainProject.uuid,
        { resourceUuid: store.laptop.uuid, startDate: '2026-08-05', endDate: '2026-08-15' },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.create(
        store.mainProject.uuid,
        { resourceUuid: store.laptop.uuid, startDate: '2026-08-10', endDate: '2026-08-12' },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows consecutive assignments without overlap', async () => {
    seedAssignment(store, { resourceUuid: store.laptop.uuid, startDate: '2026-08-01', endDate: '2026-08-10' });

    await expect(
      service.create(
        store.mainProject.uuid,
        { resourceUuid: store.laptop.uuid, startDate: '2026-08-11', endDate: '2026-08-12' },
        adminUser,
      ),
    ).resolves.toMatchObject({ startDate: '2026-08-11', endDate: '2026-08-12' });
  });

  it('rejects updates that create conflicts and excludes its own assignment otherwise', async () => {
    const firstAssignment = seedAssignment(store, {
      resourceUuid: store.laptop.uuid,
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    });
    const secondAssignment = seedAssignment(store, {
      resourceUuid: store.laptop.uuid,
      startDate: '2026-08-11',
      endDate: '2026-08-20',
    });

    await expect(
      service.update(firstAssignment.uuid, { notes: 'Sin cambio de fechas' }, adminUser),
    ).resolves.toMatchObject({ uuid: firstAssignment.uuid });
    await expect(
      service.update(secondAssignment.uuid, { startDate: '2026-08-10' }, adminUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft delete frees resource availability and keeps history', async () => {
    const assignment = seedAssignment(store, {
      resourceUuid: store.laptop.uuid,
      startDate: '2026-08-05',
      endDate: '2026-08-10',
    });

    const unavailableResources = await service.findAvailableResources(
      store.mainProject.uuid,
      { startDate: '2026-08-05', endDate: '2026-08-10', taskUuid: store.mainTask.uuid },
      managerUser,
    );

    expect(unavailableResources).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ uuid: store.laptop.uuid })]),
    );

    await service.remove(assignment.uuid, adminUser);

    expect(assignment.deletedAt).toBeInstanceOf(Date);
    const availableResources = await service.findAvailableResources(
      store.mainProject.uuid,
      { startDate: '2026-08-05', endDate: '2026-08-10', taskUuid: store.mainTask.uuid },
      managerUser,
    );

    expect(availableResources).toEqual(
      expect.arrayContaining([expect.objectContaining({ uuid: store.laptop.uuid })]),
    );
  });

  it('enforces Administrator, Project Manager and User permissions', async () => {
    await expect(
      service.create(
        store.otherProject.uuid,
        { resourceUuid: store.laptop.uuid, startDate: '2026-08-01', endDate: '2026-08-02' },
        adminUser,
      ),
    ).resolves.toMatchObject({ projectUuid: store.otherProject.uuid });
    await expect(
      service.create(
        store.otherProject.uuid,
        { resourceUuid: store.tablet.uuid, startDate: '2026-08-03', endDate: '2026-08-04' },
        managerUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create(
        store.mainProject.uuid,
        { resourceUuid: store.tablet.uuid, startDate: '2026-08-03', endDate: '2026-08-04' },
        regularUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    seedAssignment(store, {
      resourceUuid: store.tablet.uuid,
      startDate: '2026-08-05',
      endDate: '2026-08-06',
    });
    await expect(service.findAll(store.mainProject.uuid, {}, regularUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('prevents two concurrent requests from reserving the same resource', async () => {
    const firstRequest = service.create(
      store.mainProject.uuid,
      { resourceUuid: store.laptop.uuid, startDate: '2026-08-01', endDate: '2026-08-05' },
      adminUser,
    );
    const secondRequest = service.create(
      store.mainProject.uuid,
      { resourceUuid: store.laptop.uuid, startDate: '2026-08-01', endDate: '2026-08-05' },
      adminUser,
    );

    const results = await Promise.allSettled([firstRequest, secondRequest]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(store.resourceAssignments.filter((assignment) => assignment.deletedAt === null)).toHaveLength(1);
  });

  it('calculates temporal status using the current date in America/La_Paz', async () => {
    jest.setSystemTime(new Date('2026-07-29T03:59:59.000Z'));
    seedAssignment(store, {
      resourceUuid: store.laptop.uuid,
      startDate: '2026-07-28',
      endDate: '2026-07-28',
    });

    await expect(
      service.findAll(
        store.mainProject.uuid,
        { temporalStatus: ResourceAssignmentTemporalStatus.ACTIVE },
        managerUser,
      ),
    ).resolves.toMatchObject([{ temporalStatus: ResourceAssignmentTemporalStatus.ACTIVE }]);
  });
});

interface InMemoryStore {
  users: User[];
  projects: Project[];
  tasks: Task[];
  projectMembers: ProjectMember[];
  resources: Resource[];
  resourceAssignments: ResourceAssignment[];
  mainProject: Project;
  otherProject: Project;
  mainTask: Task;
  otherTask: Task;
  laptop: Resource;
  tablet: Resource;
  maintenanceServer: Resource;
}

function createBaseStore(): InMemoryStore {
  const users = [
    createUser(adminUser.uuid, UserRole.ADMIN),
    createUser(managerUser.uuid, UserRole.PROJECT_MANAGER),
    createUser(otherManagerUser.uuid, UserRole.PROJECT_MANAGER),
    createUser(regularUser.uuid, UserRole.USER),
  ];
  const mainProject = createProject(managerUser.uuid, {
    startDate: '2026-07-28',
    endDate: '2026-08-31',
  });
  const otherProject = createProject(otherManagerUser.uuid);
  const mainTask = createTask(mainProject.uuid, { startDate: '2026-08-05', endDate: '2026-08-10' });
  const otherTask = createTask(otherProject.uuid, { startDate: '2026-08-05', endDate: '2026-08-10' });
  const laptop = createResource({ code: 'LAP-001', category: ResourceCategory.LAPTOP });
  const tablet = createResource({ code: 'TAB-001', category: ResourceCategory.TABLET });
  const maintenanceServer = createResource({
    code: 'SRV-001',
    category: ResourceCategory.SERVER,
    operationalStatus: ResourceOperationalStatus.MAINTENANCE,
  });

  return {
    users,
    projects: [mainProject, otherProject],
    tasks: [mainTask, otherTask],
    projectMembers: [
      createProjectMember(mainProject.uuid, managerUser.uuid),
      createProjectMember(mainProject.uuid, regularUser.uuid),
      createProjectMember(otherProject.uuid, otherManagerUser.uuid),
    ],
    resources: [laptop, tablet, maintenanceServer],
    resourceAssignments: [],
    mainProject,
    otherProject,
    mainTask,
    otherTask,
    laptop,
    tablet,
    maintenanceServer,
  };
}

class InMemoryDataSource {
  readonly resourceAssignmentsRepository: InMemoryRepository<ResourceAssignment>;
  readonly resourcesRepository: InMemoryRepository<Resource>;
  readonly projectsRepository: InMemoryRepository<Project>;
  readonly tasksRepository: InMemoryRepository<Task>;
  readonly projectMembersRepository: InMemoryRepository<ProjectMember>;
  readonly manager: InMemoryEntityManager;
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(private readonly store: InMemoryStore) {
    this.resourceAssignmentsRepository = new InMemoryRepository(store, 'resourceAssignments');
    this.resourcesRepository = new InMemoryRepository(store, 'resources');
    this.projectsRepository = new InMemoryRepository(store, 'projects');
    this.tasksRepository = new InMemoryRepository(store, 'tasks');
    this.projectMembersRepository = new InMemoryRepository(store, 'projectMembers');
    this.manager = new InMemoryEntityManager(this);
  }

  transaction<T>(callback: (entityManager: EntityManager) => Promise<T>): Promise<T> {
    const result = this.transactionQueue.then(() => callback(this.manager as unknown as EntityManager));
    this.transactionQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  getRepository<T extends EntityWithUuid>(entity: EntityClass): InMemoryRepository<T> {
    if (entity === ResourceAssignment) {
      return this.resourceAssignmentsRepository as unknown as InMemoryRepository<T>;
    }

    if (entity === Resource) {
      return this.resourcesRepository as unknown as InMemoryRepository<T>;
    }

    if (entity === Project) {
      return this.projectsRepository as unknown as InMemoryRepository<T>;
    }

    if (entity === Task) {
      return this.tasksRepository as unknown as InMemoryRepository<T>;
    }

    return this.projectMembersRepository as unknown as InMemoryRepository<T>;
  }
}

class InMemoryEntityManager {
  constructor(private readonly dataSource: InMemoryDataSource) {}

  getRepository<T extends EntityWithUuid>(entity: EntityClass): InMemoryRepository<T> {
    return this.dataSource.getRepository(entity);
  }
}

type EntityCollectionName =
  | 'resources'
  | 'projects'
  | 'tasks'
  | 'projectMembers'
  | 'resourceAssignments';
interface EntityWithUuid {
  uuid?: string;
  deletedAt?: Date | null;
}
type EntityClass =
  | typeof ResourceAssignment
  | typeof Resource
  | typeof Project
  | typeof Task
  | typeof ProjectMember;

class InMemoryRepository<T extends EntityWithUuid> {
  constructor(
    private readonly store: InMemoryStore,
    private readonly collectionName: EntityCollectionName,
  ) {}

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    const item =
      this.collection.find(
        (candidate) =>
          (options.withDeleted === true || candidate.deletedAt === undefined || candidate.deletedAt === null) &&
          matchesWhere(candidate, options.where),
      ) ?? null;

    if (item !== null && this.collectionName === 'resourceAssignments') {
      hydrateResourceAssignment(item as unknown as ResourceAssignment, this.store);
    }

    return Promise.resolve(item);
  }

  count(options: { where: Partial<T> }): Promise<number> {
    return Promise.resolve(
      this.collection.filter(
        (candidate) =>
          (candidate.deletedAt === undefined || candidate.deletedAt === null) &&
          matchesWhere(candidate, options.where),
      ).length,
    );
  }

  create(input: Partial<T>): T {
    return input as T;
  }

  save(entity: T): Promise<T> {
    const existingIndex = this.collection.findIndex((candidate) => candidate.uuid === entity.uuid);

    if (existingIndex === -1) {
      entity.uuid ??= randomUUID();
      setAuditDates(entity);
      this.collection.push(entity);
    } else {
      (entity as EntityWithUuid & { updatedAt?: Date }).updatedAt = new Date(
        '2026-07-29T16:05:00.000Z',
      );
      this.collection[existingIndex] = entity;
    }

    if (this.collectionName === 'resourceAssignments') {
      hydrateResourceAssignment(entity as unknown as ResourceAssignment, this.store);
    }

    return Promise.resolve(entity);
  }

  softRemove(entity: T): Promise<T> {
    entity.deletedAt = new Date('2026-07-29T16:10:00.000Z');
    return Promise.resolve(entity);
  }

  createQueryBuilder(alias: string): ResourceAssignmentQueryBuilder | ResourceQueryBuilder {
    if (this.collectionName === 'resourceAssignments') {
      return new ResourceAssignmentQueryBuilder(this.store, alias);
    }

    return new ResourceQueryBuilder(this.store);
  }

  private get collection(): T[] {
    return this.store[this.collectionName] as unknown as T[];
  }
}

interface FindOneOptions<T> {
  where: Partial<T>;
  withDeleted?: boolean;
  relations?: unknown;
  lock?: unknown;
}

class ResourceAssignmentQueryBuilder {
  private projectUuid?: string;
  private resourceUuid?: string;
  private taskUuid?: string;
  private category?: ResourceCategory;
  private rangeStartDate?: string;
  private rangeEndDate?: string;
  private ignoredAssignmentUuid?: string;
  private temporalStatus?: ResourceAssignmentTemporalStatus;
  private today?: string;

  constructor(
    private readonly store: InMemoryStore,
    private readonly alias: string,
  ) {}

  setLock(): this {
    return this;
  }

  innerJoinAndSelect(): this {
    return this;
  }

  leftJoinAndSelect(): this {
    return this;
  }

  where(condition: string, params: Record<string, unknown>): this {
    return this.applyCondition(condition, params);
  }

  andWhere(condition: string, params?: Record<string, unknown>): this {
    return this.applyCondition(condition, params);
  }

  orderBy(): this {
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  getOne(): Promise<ResourceAssignment | null> {
    const assignments = this.filterAssignments();
    return Promise.resolve(assignments[0] ?? null);
  }

  getMany(): Promise<ResourceAssignment[]> {
    return Promise.resolve(this.filterAssignments());
  }

  private applyCondition(condition: string, params?: Record<string, unknown>): this {
    if (typeof params?.projectUuid === 'string') {
      this.projectUuid = params.projectUuid;
    }

    if (typeof params?.resourceUuid === 'string') {
      this.resourceUuid = params.resourceUuid;
    }

    if (typeof params?.taskUuid === 'string') {
      this.taskUuid = params.taskUuid;
    }

    if (params?.category !== undefined) {
      this.category = params.category as ResourceCategory;
    }

    if (typeof params?.ignoredAssignmentUuid === 'string') {
      this.ignoredAssignmentUuid = params.ignoredAssignmentUuid;
    }

    if (typeof params?.startDate === 'string' && condition.includes(`${this.alias}.endDate >=`)) {
      this.rangeStartDate = params.startDate;
    }

    if (typeof params?.endDate === 'string' && condition.includes(`${this.alias}.startDate <=`)) {
      this.rangeEndDate = params.endDate;
    }

    if (typeof params?.today === 'string') {
      this.today = params.today;

      if (condition.includes(`${this.alias}.endDate <`)) {
        this.temporalStatus = ResourceAssignmentTemporalStatus.FINISHED;
      } else if (condition.includes(`${this.alias}.startDate >`)) {
        this.temporalStatus = ResourceAssignmentTemporalStatus.SCHEDULED;
      } else {
        this.temporalStatus = ResourceAssignmentTemporalStatus.ACTIVE;
      }
    }

    return this;
  }

  private filterAssignments(): ResourceAssignment[] {
    return this.store.resourceAssignments
      .filter((assignment) => assignment.deletedAt === null)
      .filter((assignment) => this.projectUuid === undefined || assignment.projectUuid === this.projectUuid)
      .filter((assignment) => this.resourceUuid === undefined || assignment.resourceUuid === this.resourceUuid)
      .filter((assignment) => this.taskUuid === undefined || assignment.taskUuid === this.taskUuid)
      .filter(
        (assignment) =>
          this.ignoredAssignmentUuid === undefined || assignment.uuid !== this.ignoredAssignmentUuid,
      )
      .filter(
        (assignment) =>
          this.rangeEndDate === undefined || assignment.startDate <= this.rangeEndDate,
      )
      .filter(
        (assignment) =>
          this.rangeStartDate === undefined || assignment.endDate >= this.rangeStartDate,
      )
      .filter((assignment) => {
        if (this.category === undefined) {
          return true;
        }

        const resource = this.store.resources.find((candidate) => candidate.uuid === assignment.resourceUuid);
        return resource?.category === this.category;
      })
      .filter((assignment) => {
        if (this.temporalStatus === undefined || this.today === undefined) {
          return true;
        }

        return calculateStatus(assignment, this.today) === this.temporalStatus;
      })
      .map((assignment) => hydrateResourceAssignment(assignment, this.store))
      .sort((first, second) => first.startDate.localeCompare(second.startDate));
  }
}

class ResourceQueryBuilder {
  private startDate?: string;
  private endDate?: string;

  constructor(private readonly store: InMemoryStore) {}

  where(): this {
    return this;
  }

  andWhere(_condition: string, params?: Record<string, unknown>): this {
    if (typeof params?.startDate === 'string') {
      this.startDate = params.startDate;
    }

    if (typeof params?.endDate === 'string') {
      this.endDate = params.endDate;
    }

    return this;
  }

  orderBy(): this {
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  getMany(): Promise<Resource[]> {
    return Promise.resolve(
      this.store.resources
        .filter((resource) => resource.deletedAt === null)
        .filter((resource) => resource.isActive)
        .filter((resource) => resource.operationalStatus === ResourceOperationalStatus.OPERATIONAL)
        .filter(
          (resource) =>
            this.startDate === undefined ||
            this.endDate === undefined ||
            !this.store.resourceAssignments.some(
              (assignment) =>
                assignment.deletedAt === null &&
                assignment.resourceUuid === resource.uuid &&
                assignment.startDate <= (this.endDate ?? '') &&
                assignment.endDate >= (this.startDate ?? ''),
            ),
        )
        .sort((first, second) => first.code.localeCompare(second.code)),
    );
  }
}

function seedAssignment(
  store: InMemoryStore,
  overrides: Partial<ResourceAssignment>,
): ResourceAssignment {
  const assignment = createResourceAssignment({
    resourceUuid: overrides.resourceUuid ?? store.laptop.uuid,
    projectUuid: overrides.projectUuid ?? store.mainProject.uuid,
    taskUuid: overrides.taskUuid ?? null,
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-05',
    assignedByUuid: overrides.assignedByUuid ?? adminUser.uuid,
    notes: overrides.notes ?? null,
  });
  store.resourceAssignments.push(hydrateResourceAssignment(assignment, store));
  return assignment;
}

function hydrateResourceAssignment(
  assignment: ResourceAssignment,
  store: InMemoryStore,
): ResourceAssignment {
  const resource = store.resources.find((candidate) => candidate.uuid === assignment.resourceUuid);
  const project = store.projects.find((candidate) => candidate.uuid === assignment.projectUuid);
  const task =
    assignment.taskUuid === null
      ? null
      : store.tasks.find((candidate) => candidate.uuid === assignment.taskUuid) ?? null;
  const assignedBy = store.users.find((candidate) => candidate.uuid === assignment.assignedByUuid);

  if (resource === undefined || project === undefined || assignedBy === undefined) {
    throw new Error('Datos de prueba incompletos para hidratar asignacion.');
  }

  assignment.resource = resource;
  assignment.project = project;
  assignment.task = task;
  assignment.assignedBy = assignedBy;

  return assignment;
}

function matchesWhere<T extends EntityWithUuid>(candidate: T, where: Partial<T>): boolean {
  return Object.entries(where).every(([key, value]) => candidate[key as keyof T] === value);
}

function setAuditDates(entity: EntityWithUuid): void {
  const auditedEntity = entity as EntityWithUuid & { createdAt?: Date; updatedAt?: Date };
  auditedEntity.deletedAt = auditedEntity.deletedAt ?? null;
  auditedEntity.createdAt = auditedEntity.createdAt ?? new Date('2026-07-29T16:00:00.000Z');
  auditedEntity.updatedAt = new Date('2026-07-29T16:00:00.000Z');
}

function calculateStatus(
  assignment: ResourceAssignment,
  today: string,
): ResourceAssignmentTemporalStatus {
  if (assignment.endDate < today) {
    return ResourceAssignmentTemporalStatus.FINISHED;
  }

  if (assignment.startDate > today) {
    return ResourceAssignmentTemporalStatus.SCHEDULED;
  }

  return ResourceAssignmentTemporalStatus.ACTIVE;
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
    createdAt: new Date('2026-07-29T16:00:00.000Z'),
    updatedAt: new Date('2026-07-29T16:00:00.000Z'),
    managedProjects: [],
    projectMemberships: [],
    taskAssignments: [],
    resourceAssignmentsCreated: [],
  };
}

function createProject(managerUuid: string, overrides: Partial<Project> = {}): Project {
  return {
    uuid: overrides.uuid ?? randomUUID(),
    name: overrides.name ?? 'Proyecto PROPLAN',
    description: overrides.description ?? null,
    objective: overrides.objective ?? 'Planificar el proyecto.',
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-31',
    status: overrides.status ?? ProjectStatus.PLANNING,
    approvedBudget: overrides.approvedBudget ?? '0.00',
    managerUuid,
    createdAt: new Date('2026-07-29T16:00:00.000Z'),
    updatedAt: new Date('2026-07-29T16:00:00.000Z'),
    deletedAt: overrides.deletedAt ?? null,
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
    name: overrides.name ?? 'Pruebas de campo',
    description: overrides.description ?? null,
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-15',
    status: overrides.status ?? TaskStatus.PENDING,
    progress: overrides.progress ?? 0,
    estimatedHours: overrides.estimatedHours ?? '0.00',
    plannedBudget: overrides.plannedBudget ?? '0.00',
    actualCost: overrides.actualCost ?? '0.00',
    createdAt: new Date('2026-07-29T16:00:00.000Z'),
    updatedAt: new Date('2026-07-29T16:00:00.000Z'),
    deletedAt: overrides.deletedAt ?? null,
    project: createProject(managerUser.uuid),
    parentTask: null,
    subtasks: [],
    assignments: [],
    outgoingDependencies: [],
    incomingDependencies: [],
    resourceAssignments: [],
  };
}

function createResource(overrides: Partial<Resource> = {}): Resource {
  return {
    uuid: overrides.uuid ?? randomUUID(),
    name: overrides.name ?? 'Recurso LogistiSoft',
    description: overrides.description ?? null,
    code: overrides.code ?? 'REC-001',
    category: overrides.category ?? ResourceCategory.LAPTOP,
    serialNumber: overrides.serialNumber ?? null,
    operationalStatus: overrides.operationalStatus ?? ResourceOperationalStatus.OPERATIONAL,
    notes: overrides.notes ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: new Date('2026-07-29T16:00:00.000Z'),
    updatedAt: new Date('2026-07-29T16:00:00.000Z'),
    deletedAt: overrides.deletedAt ?? null,
    assignments: [],
  };
}

function createProjectMember(projectUuid: string, userUuid: string): ProjectMember {
  return {
    uuid: randomUUID(),
    projectUuid,
    userUuid,
    joinedAt: new Date('2026-07-29T16:00:00.000Z'),
    project: createProject(managerUser.uuid),
    user: createUser(userUuid, UserRole.USER),
  };
}

function createResourceAssignment(
  overrides: Pick<
    ResourceAssignment,
    'resourceUuid' | 'projectUuid' | 'taskUuid' | 'startDate' | 'endDate' | 'assignedByUuid' | 'notes'
  >,
): ResourceAssignment {
  return {
    uuid: randomUUID(),
    resourceUuid: overrides.resourceUuid,
    projectUuid: overrides.projectUuid,
    taskUuid: overrides.taskUuid,
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    assignedByUuid: overrides.assignedByUuid,
    notes: overrides.notes,
    createdAt: new Date('2026-07-29T16:00:00.000Z'),
    updatedAt: new Date('2026-07-29T16:00:00.000Z'),
    deletedAt: null,
    resource: createResource(),
    project: createProject(managerUser.uuid),
    task: null,
    assignedBy: createUser(adminUser.uuid, UserRole.ADMIN),
  };
}
