import { Repository } from 'typeorm';

import { ResourceCategory } from '../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { ResourceAssignment } from '../../modules/resource-assignments/entities/resource-assignment.entity';
import { Resource } from '../../modules/resources/entities/resource.entity';
import {
  demoResourceAssignments,
  demoResources,
  seedResourceAssignments,
  seedResources,
  validateDemoBudgets,
  validateDemoResourceAssignments,
} from './seed-demo-data';

describe('seed demo resource data', () => {
  it('uses unique resource codes and valid non overlapping assignments', () => {
    const uniqueCodes = new Set(demoResources.map((resource) => resource.code));
    const uniqueAssignmentUuids = new Set(
      demoResourceAssignments.map((assignment) => assignment.uuid),
    );

    expect(uniqueCodes.size).toBe(demoResources.length);
    expect(uniqueAssignmentUuids.size).toBe(demoResourceAssignments.length);
    expect(demoResourceAssignments.length).toBeGreaterThanOrEqual(15);
    expect(() => {
      validateDemoResourceAssignments();
    }).not.toThrow();
    expect(
      demoResourceAssignments.some((assignment) =>
        assignment.notes?.includes('debe mostrar conflicto'),
      ),
    ).toBe(true);
  });

  it('keeps demo project budgets within approved amounts', () => {
    expect(() => {
      validateDemoBudgets();
    }).not.toThrow();
  });

  it('seeds resources and assignments idempotently', async () => {
    const resourceRepository = new InMemoryResourceRepository();
    const resourceAssignmentRepository = new InMemoryResourceAssignmentRepository();
    const resourceUuidByKey = await seedResources(
      resourceRepository as unknown as Repository<Resource>,
    );

    await seedResources(resourceRepository as unknown as Repository<Resource>);
    await seedResourceAssignments(
      resourceAssignmentRepository as unknown as Repository<ResourceAssignment>,
      resourceUuidByKey,
      mapByKey([
        ['lastMile2025', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
        ['coldChain2026', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'],
        ['routeOptimizer2026', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'],
      ]),
      mapByKey([
        ['lastMileDiscovery', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101'],
        ['lastMileGpsIntegration', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb102'],
        ['lastMileMobileProof', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103'],
        ['lastMileClosure', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb104'],
        ['coldChainBackend', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb202'],
        ['coldChainDashboard', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb203'],
        ['coldChainQa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb204'],
        ['coldChainClosure', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb205'],
        ['routeGpsIntegration', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb303'],
        ['routeProviderApi', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb304'],
        ['routeAlgorithm', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb305'],
        ['routeDispatchBoard', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb306'],
        ['routeMobileQa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb401'],
      ]),
      mapByKey([
        ['pmPlanning', '22222222-2222-4222-8222-222222222222'],
        ['pmOperations', '33333333-3333-4333-8333-333333333333'],
      ]),
    );
    await seedResourceAssignments(
      resourceAssignmentRepository as unknown as Repository<ResourceAssignment>,
      resourceUuidByKey,
      mapByKey([
        ['lastMile2025', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
        ['coldChain2026', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'],
        ['routeOptimizer2026', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'],
      ]),
      mapByKey([
        ['lastMileDiscovery', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101'],
        ['lastMileGpsIntegration', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb102'],
        ['lastMileMobileProof', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103'],
        ['lastMileClosure', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb104'],
        ['coldChainBackend', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb202'],
        ['coldChainDashboard', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb203'],
        ['coldChainQa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb204'],
        ['coldChainClosure', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb205'],
        ['routeGpsIntegration', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb303'],
        ['routeProviderApi', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb304'],
        ['routeAlgorithm', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb305'],
        ['routeDispatchBoard', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb306'],
        ['routeMobileQa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb401'],
      ]),
      mapByKey([
        ['pmPlanning', '22222222-2222-4222-8222-222222222222'],
        ['pmOperations', '33333333-3333-4333-8333-333333333333'],
      ]),
    );

    expect(resourceRepository.count()).toBe(demoResources.length);
    expect(resourceAssignmentRepository.count()).toBe(demoResourceAssignments.length);
  });
});

class InMemoryResourceRepository {
  private readonly resources = new Map<string, Resource>();

  findOne(options: {
    where: readonly Partial<Resource>[];
    withDeleted?: boolean;
  }): Promise<Resource | null> {
    const resource =
      Array.from(this.resources.values()).find((candidate) =>
        options.where.some((where) => matchesWhere(candidate, where)),
      ) ?? null;

    return Promise.resolve(resource);
  }

  create(seed: Partial<Resource> = {}): Resource {
    return {
      uuid: seed.uuid ?? '',
      name: '',
      description: null,
      code: '',
      category: ResourceCategory.LAPTOP,
      serialNumber: null,
      operationalStatus: ResourceOperationalStatus.OPERATIONAL,
      notes: null,
      isActive: true,
      createdAt: new Date('2026-07-24T18:30:00.000Z'),
      updatedAt: new Date('2026-07-24T18:30:00.000Z'),
      deletedAt: null,
      assignments: [],
    };
  }

  save(resource: Resource): Promise<Resource> {
    this.resources.set(resource.uuid, resource);

    return Promise.resolve(resource);
  }

  count(): number {
    return this.resources.size;
  }
}

class InMemoryResourceAssignmentRepository {
  private readonly assignments = new Map<string, ResourceAssignment>();

  findOne(options: {
    where: Partial<ResourceAssignment>;
    withDeleted?: boolean;
  }): Promise<ResourceAssignment | null> {
    return Promise.resolve(
      Array.from(this.assignments.values()).find((assignment) =>
        matchesWhere(assignment, options.where),
      ) ?? null,
    );
  }

  create(seed: Partial<ResourceAssignment> = {}): ResourceAssignment {
    return {
      uuid: seed.uuid ?? '',
      resourceUuid: '',
      projectUuid: '',
      taskUuid: null,
      startDate: '',
      endDate: '',
      assignedByUuid: '',
      notes: null,
      createdAt: new Date('2026-07-24T18:30:00.000Z'),
      updatedAt: new Date('2026-07-24T18:30:00.000Z'),
      deletedAt: null,
      resource: {} as Resource,
      project: {},
      task: null,
      assignedBy: {},
    } as ResourceAssignment;
  }

  save(assignment: ResourceAssignment): Promise<ResourceAssignment> {
    this.assignments.set(assignment.uuid, assignment);

    return Promise.resolve(assignment);
  }

  count(): number {
    return this.assignments.size;
  }
}

function mapByKey(entries: readonly (readonly [string, string])[]): ReadonlyMap<string, string> {
  return new Map(entries);
}

function matchesWhere<T extends object>(entity: T, where: Partial<T>): boolean {
  return Object.entries(where).every(([key, value]) => entity[key as keyof T] === value);
}
