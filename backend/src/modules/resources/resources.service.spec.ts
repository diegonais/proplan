import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { ResourceCategory } from '../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { ProjectStatus } from '../../common/enums/project-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Project } from '../projects/entities/project.entity';
import { ResourceAssignment } from '../resource-assignments/entities/resource-assignment.entity';
import { User } from '../users/entities/user.entity';
import { ResourceUnavailableReason } from './dto/resource-availability-response.dto';
import { ResourceSortField, ResourceSortOrder } from './dto/list-resources-query.dto';
import { Resource } from './entities/resource.entity';
import { ResourcesService } from './resources.service';

const adminUser = createAuthenticatedUser(
  '11111111-1111-4111-8111-111111111111',
  UserRole.ADMIN,
);
const managerUser = createAuthenticatedUser(
  '22222222-2222-4222-8222-222222222222',
  UserRole.PROJECT_MANAGER,
);
const otherManagerUser = createAuthenticatedUser(
  '33333333-3333-4333-8333-333333333333',
  UserRole.PROJECT_MANAGER,
);

describe('ResourcesService', () => {
  let resourcesRepository: InMemoryResourcesRepository;
  let assignmentsRepository: InMemoryResourceAssignmentsRepository;
  let service: ResourcesService;

  beforeEach(() => {
    resourcesRepository = new InMemoryResourcesRepository();
    assignmentsRepository = new InMemoryResourceAssignmentsRepository();
    service = new ResourcesService(
      resourcesRepository as unknown as Repository<Resource>,
      assignmentsRepository as unknown as Repository<ResourceAssignment>,
    );
  });

  it('creates resources with normalized unique codes and safe responses', async () => {
    const resource = await service.create({
      name: ' Laptop Dell ',
      code: ' lap-log-001 ',
      category: ResourceCategory.LAPTOP,
      serialNumber: ' SN-1 ',
    });

    expect(resource).toMatchObject({
      name: 'Laptop Dell',
      code: 'LAP-LOG-001',
      category: ResourceCategory.LAPTOP,
      operationalStatus: ResourceOperationalStatus.OPERATIONAL,
      isActive: true,
    });
    expect(resource).not.toHaveProperty('deletedAt');
    expect(resource).not.toHaveProperty('assignments');
  });

  it('rejects duplicated resource codes after normalization', async () => {
    await service.create({
      name: 'Laptop uno',
      code: 'lap-log-001',
      category: ResourceCategory.LAPTOP,
    });

    await expect(
      service.create({
        name: 'Laptop dos',
        code: ' LAP-LOG-001 ',
        category: ResourceCategory.LAPTOP,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('edits general resource fields without changing status implicitly', async () => {
    const createdResource = await service.create({
      name: 'Servidor',
      code: 'SRV-001',
      category: ResourceCategory.SERVER,
      operationalStatus: ResourceOperationalStatus.MAINTENANCE,
    });

    await expect(
      service.update(createdResource.uuid, {
        name: 'Servidor principal',
        code: 'srv-core-001',
        category: ResourceCategory.CLOUD_SERVICE,
      }),
    ).resolves.toMatchObject({
      name: 'Servidor principal',
      code: 'SRV-CORE-001',
      category: ResourceCategory.CLOUD_SERVICE,
      operationalStatus: ResourceOperationalStatus.MAINTENANCE,
    });
  });

  it('lists resources with pagination, search, filters and allowed sorting', async () => {
    await service.create({
      name: 'Laptop QA',
      code: 'LAP-QA-001',
      category: ResourceCategory.LAPTOP,
      serialNumber: 'QA-SN-001',
    });
    await service.create({
      name: 'Servidor local',
      code: 'SRV-001',
      category: ResourceCategory.SERVER,
    });
    await service.create({
      name: 'Laptop DevOps',
      code: 'LAP-DEV-001',
      category: ResourceCategory.LAPTOP,
    });

    await service.updateStatus(resourcesRepository.resources[2]?.uuid ?? '', {
      operationalStatus: ResourceOperationalStatus.MAINTENANCE,
    });

    const response = await service.findAll({
      page: 1,
      limit: 1,
      search: 'lap',
      category: ResourceCategory.LAPTOP,
      operationalStatus: ResourceOperationalStatus.OPERATIONAL,
      orderBy: ResourceSortField.CODE,
      order: ResourceSortOrder.ASC,
    });

    expect(response.meta).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({ code: 'LAP-QA-001' });
  });

  it('changes operational status when there are no current or future assignments', async () => {
    const resource = await service.create({
      name: 'Tablet',
      code: 'TAB-001',
      category: ResourceCategory.TABLET,
    });

    await expect(
      service.updateStatus(resource.uuid, {
        operationalStatus: ResourceOperationalStatus.OUT_OF_SERVICE,
      }),
    ).resolves.toMatchObject({
      operationalStatus: ResourceOperationalStatus.OUT_OF_SERVICE,
    });
  });

  it('rejects deactivation when the resource has a future assignment', async () => {
    const resource = await saveResource(resourcesRepository);
    assignmentsRepository.assignments.push(
      createResourceAssignment(resource.uuid, {
        startDate: '2999-01-01',
        endDate: '2999-01-15',
      }),
    );

    await expect(service.updateStatus(resource.uuid, { isActive: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('calculates availability from overlapping non-deleted assignments', async () => {
    const resource = await saveResource(resourcesRepository);
    const visibleAssignment = createResourceAssignment(resource.uuid, {
      project: createProject(managerUser.uuid),
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    });
    const hiddenAssignment = createResourceAssignment(resource.uuid, {
      project: createProject(otherManagerUser.uuid),
      startDate: '2026-08-05',
      endDate: '2026-08-20',
    });
    assignmentsRepository.assignments.push(visibleAssignment, hiddenAssignment);

    await expect(
      service.checkAvailability(
        resource.uuid,
        { startDate: '2026-08-04', endDate: '2026-08-06' },
        managerUser,
      ),
    ).resolves.toMatchObject({
      available: false,
      unavailableReason: ResourceUnavailableReason.ASSIGNMENT_CONFLICT,
      conflicts: [{ uuid: visibleAssignment.uuid }],
    });
  });

  it('marks maintenance resources as unavailable without assignment details', async () => {
    const resource = await saveResource(resourcesRepository, {
      operationalStatus: ResourceOperationalStatus.MAINTENANCE,
    });

    await expect(
      service.checkAvailability(
        resource.uuid,
        { startDate: '2026-08-01', endDate: '2026-08-05' },
        adminUser,
      ),
    ).resolves.toMatchObject({
      available: false,
      unavailableReason: ResourceUnavailableReason.NON_OPERATIONAL_STATUS,
      conflicts: [],
    });
  });

  it('marks soft-deleted resources as unavailable in availability checks', async () => {
    const resource = await saveResource(resourcesRepository);
    await service.remove(resource.uuid);

    await expect(service.findOne(resource.uuid)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.checkAvailability(
        resource.uuid,
        { startDate: '2026-08-01', endDate: '2026-08-05' },
        adminUser,
      ),
    ).resolves.toMatchObject({
      available: false,
      unavailableReason: ResourceUnavailableReason.RESOURCE_DELETED,
    });
  });

  it('soft deletes resources and keeps past history untouched', async () => {
    const resource = await saveResource(resourcesRepository);

    await service.remove(resource.uuid);

    expect(resourcesRepository.resources[0]?.deletedAt).toBeInstanceOf(Date);
    await expect(service.findOne(resource.uuid)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid availability date ranges', async () => {
    const resource = await saveResource(resourcesRepository);

    await expect(
      service.checkAvailability(
        resource.uuid,
        { startDate: '2026-08-10', endDate: '2026-08-01' },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
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

function createProject(managerUuid: string): Project {
  return {
    uuid: randomUUID(),
    name: 'Proyecto PROPLAN',
    description: null,
    objective: 'Planificar el proyecto.',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: ProjectStatus.PLANNING,
    approvedBudget: '0.00',
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

function createResource(overrides: Partial<Resource> = {}): Resource {
  return {
    uuid: overrides.uuid ?? randomUUID(),
    name: overrides.name ?? 'Laptop Dell',
    description: overrides.description ?? null,
    code: overrides.code ?? 'LAP-001',
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

function createResourceAssignment(
  resourceUuid: string,
  overrides: Partial<ResourceAssignment> = {},
): ResourceAssignment {
  const project = overrides.project ?? createProject(managerUser.uuid);

  return {
    uuid: overrides.uuid ?? randomUUID(),
    resourceUuid,
    projectUuid: overrides.projectUuid ?? project.uuid,
    taskUuid: overrides.taskUuid ?? null,
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-15',
    assignedByUuid: overrides.assignedByUuid ?? adminUser.uuid,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-07-24T18:30:00.000Z'),
    deletedAt: overrides.deletedAt ?? null,
    resource: overrides.resource ?? createResource({ uuid: resourceUuid }),
    project,
    task: overrides.task ?? null,
    assignedBy: overrides.assignedBy ?? createUser(adminUser.uuid, UserRole.ADMIN),
  };
}

async function saveResource(
  repository: InMemoryResourcesRepository,
  overrides: Partial<Resource> = {},
): Promise<Resource> {
  return repository.save(createResource(overrides));
}

class InMemoryResourcesRepository {
  resources: Resource[] = [];

  create(input: Partial<Resource>): Resource {
    return createResource(input);
  }

  save(resource: Resource): Promise<Resource> {
    const existingIndex = this.resources.findIndex((candidate) => candidate.uuid === resource.uuid);

    resource.updatedAt = new Date('2026-07-24T18:35:00.000Z');

    if (existingIndex === -1) {
      this.resources.push(resource);
      return Promise.resolve(resource);
    }

    this.resources[existingIndex] = resource;
    return Promise.resolve(resource);
  }

  findOne(options: { where: Partial<Resource>; withDeleted?: boolean }): Promise<Resource | null> {
    return Promise.resolve(
      this.resources.find(
        (resource) =>
          (options.withDeleted === true || resource.deletedAt === null) &&
          Object.entries(options.where).every(
            ([key, value]) => resource[key as keyof Resource] === value,
          ),
      ) ?? null,
    );
  }

  softRemove(resource: Resource): Promise<Resource> {
    resource.deletedAt = new Date('2026-07-24T18:40:00.000Z');
    return Promise.resolve(resource);
  }

  createQueryBuilder(): ResourceQueryBuilder {
    return new ResourceQueryBuilder(this.resources);
  }
}

class ResourceQueryBuilder {
  private search?: string;
  private category?: ResourceCategory;
  private operationalStatus?: ResourceOperationalStatus;
  private isActive?: boolean;
  private sortColumn: ResourceSortField = ResourceSortField.CREATED_AT;
  private sortOrder: 'ASC' | 'DESC' = 'DESC';
  private skipCount = 0;
  private takeCount = 10;

  constructor(private readonly resources: Resource[]) {}

  andWhere(_condition: unknown, params?: Record<string, unknown>): this {
    if (typeof params?.search === 'string') {
      this.search = params.search.replaceAll('%', '').toLowerCase();
    }

    if (params?.category !== undefined) {
      this.category = params.category as ResourceCategory;
    }

    if (params?.operationalStatus !== undefined) {
      this.operationalStatus = params.operationalStatus as ResourceOperationalStatus;
    }

    if (typeof params?.isActive === 'boolean') {
      this.isActive = params.isActive;
    }

    return this;
  }

  orderBy(column: string, order: 'ASC' | 'DESC'): this {
    this.sortColumn = column.replace('resource.', '') as ResourceSortField;
    this.sortOrder = order;
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  skip(value: number): this {
    this.skipCount = value;
    return this;
  }

  take(value: number): this {
    this.takeCount = value;
    return this;
  }

  getManyAndCount(): Promise<[Resource[], number]> {
    const filteredResources = this.resources
      .filter((resource) => resource.deletedAt === null)
      .filter((resource) => {
        if (this.search === undefined) {
          return true;
        }

        return [resource.name, resource.code, resource.serialNumber ?? ''].some((field) =>
          field.toLowerCase().includes(this.search ?? ''),
        );
      })
      .filter((resource) => this.category === undefined || resource.category === this.category)
      .filter(
        (resource) =>
          this.operationalStatus === undefined ||
          resource.operationalStatus === this.operationalStatus,
      )
      .filter((resource) => this.isActive === undefined || resource.isActive === this.isActive)
      .sort((firstResource, secondResource) => {
        const firstValue = String(firstResource[this.sortColumn]);
        const secondValue = String(secondResource[this.sortColumn]);
        const comparison = firstValue.localeCompare(secondValue);

        return this.sortOrder === 'ASC' ? comparison : -comparison;
      });

    return Promise.resolve([
      filteredResources.slice(this.skipCount, this.skipCount + this.takeCount),
      filteredResources.length,
    ]);
  }
}

class InMemoryResourceAssignmentsRepository {
  assignments: ResourceAssignment[] = [];

  createQueryBuilder(): ResourceAssignmentQueryBuilder {
    return new ResourceAssignmentQueryBuilder(this.assignments);
  }
}

class ResourceAssignmentQueryBuilder {
  private resourceUuid?: string;
  private today?: string;
  private startDate?: string;
  private endDate?: string;

  constructor(private readonly assignments: ResourceAssignment[]) {}

  leftJoinAndSelect(): this {
    return this;
  }

  where(_condition: string, params: Record<string, unknown>): this {
    return this.applyParams(params);
  }

  andWhere(_condition: string, params?: Record<string, unknown>): this {
    return this.applyParams(params);
  }

  orderBy(): this {
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  getCount(): Promise<number> {
    return Promise.resolve(
      this.assignments.filter(
        (assignment) =>
          assignment.deletedAt === null &&
          assignment.resourceUuid === this.resourceUuid &&
          (this.today === undefined || assignment.endDate >= this.today),
      ).length,
    );
  }

  getMany(): Promise<ResourceAssignment[]> {
    return Promise.resolve(
      this.assignments
        .filter(
          (assignment) =>
            assignment.deletedAt === null &&
            assignment.resourceUuid === this.resourceUuid &&
            (this.endDate === undefined || assignment.startDate <= this.endDate) &&
            (this.startDate === undefined || assignment.endDate >= this.startDate),
        )
        .sort((firstAssignment, secondAssignment) =>
          firstAssignment.startDate.localeCompare(secondAssignment.startDate),
        ),
    );
  }

  private applyParams(params?: Record<string, unknown>): this {
    if (typeof params?.resourceUuid === 'string') {
      this.resourceUuid = params.resourceUuid;
    }

    if (typeof params?.today === 'string') {
      this.today = params.today;
    }

    if (typeof params?.startDate === 'string') {
      this.startDate = params.startDate;
    }

    if (typeof params?.endDate === 'string') {
      this.endDate = params.endDate;
    }

    return this;
  }
}
