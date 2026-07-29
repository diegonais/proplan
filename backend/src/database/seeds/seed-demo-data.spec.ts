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
  validateDemoResourceAssignments,
} from './seed-demo-data';

describe('seed demo resource data', () => {
  it('uses unique resource codes and valid non overlapping assignments', () => {
    const uniqueCodes = new Set(demoResources.map((resource) => resource.code));

    expect(uniqueCodes.size).toBe(demoResources.length);
    expect(demoResourceAssignments.length).toBeGreaterThanOrEqual(10);
    expect(() => {
      validateDemoResourceAssignments();
    }).not.toThrow();
    expect(
      demoResourceAssignments.some((assignment) =>
        assignment.notes?.includes('debe mostrar conflicto'),
      ),
    ).toBe(true);
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
        ['greenPlanning', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
        ['yellowCosts', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'],
        ['redMigration', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'],
        ['completedPilot', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'],
      ]),
      mapByKey([
        ['greenDiscovery', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101'],
        ['greenDesign', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb102'],
        ['greenDashboardPrototype', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103'],
        ['greenProjectsModule', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb104'],
        ['yellowValidation', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb203'],
        ['yellowValidationRules', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb204'],
        ['redInventory', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb301'],
        ['redSchedule', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb302'],
        ['completedExecution', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb402'],
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
        ['greenPlanning', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
        ['yellowCosts', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'],
        ['redMigration', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'],
        ['completedPilot', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'],
      ]),
      mapByKey([
        ['greenDiscovery', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101'],
        ['greenDesign', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb102'],
        ['greenDashboardPrototype', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103'],
        ['greenProjectsModule', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb104'],
        ['yellowValidation', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb203'],
        ['yellowValidationRules', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb204'],
        ['redInventory', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb301'],
        ['redSchedule', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb302'],
        ['completedExecution', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb402'],
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
