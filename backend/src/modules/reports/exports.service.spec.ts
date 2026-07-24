import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskDependencyType } from '../../common/enums/task-dependency-type.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../task-dependencies/entities/task-dependency.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { ExportsService, formatDateTimeInLaPaz, sanitizeExcelText } from './exports.service';

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

describe('ExportsService', () => {
  let projectsRepository: InMemoryProjectsRepository;
  let tasksRepository: InMemoryTasksRepository;
  let dependenciesRepository: InMemoryTaskDependenciesRepository;
  let assignmentsRepository: InMemoryTaskAssignmentsRepository;
  let membersRepository: InMemoryProjectMembersRepository;
  let service: ExportsService;
  let project: Project;
  let parentTask: Task;
  let childTask: Task;

  beforeEach(() => {
    project = createProject();
    parentTask = createTask({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      name: '=Actividad con formula',
      plannedBudget: '600.00',
      actualCost: '250.00',
      progress: 50,
    });
    childTask = createTask({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      parentTaskUuid: parentTask.uuid,
      name: 'Subactividad',
      plannedBudget: '200.00',
      actualCost: '100.00',
      progress: 100,
      status: TaskStatus.COMPLETED,
    });
    projectsRepository = new InMemoryProjectsRepository([project]);
    tasksRepository = new InMemoryTasksRepository([parentTask, childTask]);
    dependenciesRepository = new InMemoryTaskDependenciesRepository([
      createDependency(parentTask.uuid, childTask.uuid),
    ]);
    assignmentsRepository = new InMemoryTaskAssignmentsRepository([
      createAssignment(parentTask.uuid, regularUser.uuid, '12.00', true),
      createAssignment(childTask.uuid, managerUser.uuid, '4.00', true),
    ]);
    membersRepository = new InMemoryProjectMembersRepository([
      createMember(project.uuid, managerUser.uuid),
      createMember(project.uuid, regularUser.uuid),
    ]);
    service = new ExportsService(
      projectsRepository as unknown as Repository<Project>,
      tasksRepository as unknown as Repository<Task>,
      dependenciesRepository as unknown as Repository<TaskDependency>,
      assignmentsRepository as unknown as Repository<TaskAssignment>,
      membersRepository as unknown as Repository<ProjectMember>,
    );
  });

  it('generates a non empty PDF with safe headers metadata', async () => {
    const file = await service.generateProjectPdf(project.uuid, adminUser);

    expect(file.contentType).toBe('application/pdf');
    expect(file.fileName).toMatch(/^proplan-proyecto-exportable-/);
    expect(file.fileName).toMatch(/\.pdf$/);
    expect(file.buffer.length).toBeGreaterThan(1000);
  });

  it('generates an Excel workbook with the required sheets', async () => {
    const workbook = await loadGeneratedWorkbook(service, project.uuid, adminUser);

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual([
      'Proyecto',
      'Actividades',
      'Asignaciones',
      'Equipo',
      'Presupuesto y costos',
      'Dependencias',
    ]);
  });

  it('sanitizes user controlled values that could be interpreted as Excel formulas', async () => {
    const workbook = await loadGeneratedWorkbook(service, project.uuid, adminUser);
    const worksheet = workbook.getWorksheet('Actividades');

    expect(worksheet?.getCell('B2').value).toBe("'=Actividad con formula");
    expect(sanitizeExcelText('+SUM(1,1)')).toBe("'+SUM(1,1)");
    expect(sanitizeExcelText('-10')).toBe("'-10");
    expect(sanitizeExcelText('@usuario')).toBe("'@usuario");
  });

  it('uses America La Paz for generation timestamp without changing YYYY-MM-DD planning dates', async () => {
    const workbook = await loadGeneratedWorkbook(service, project.uuid, adminUser);
    const projectWorksheet = workbook.getWorksheet('Proyecto');
    const tasksWorksheet = workbook.getWorksheet('Actividades');

    expect(projectWorksheet?.getCell('B13').value).toEqual(expect.stringContaining('America/La_Paz'));
    expect(formatDateTimeInLaPaz(new Date('2026-07-25T03:30:00.000Z'))).toBe(
      '2026-07-24 23:30:00 America/La_Paz',
    );
    expect(tasksWorksheet?.getCell('E2').value).toBe('2026-08-01');
    expect(tasksWorksheet?.getCell('F2').value).toBe('2026-08-05');
  });

  it('exports correct financial information and excludes sensitive user fields', async () => {
    const workbook = await loadGeneratedWorkbook(service, project.uuid, adminUser);
    const budgetWorksheet = workbook.getWorksheet('Presupuesto y costos');
    const allValues = workbook.worksheets
      .flatMap((worksheet) => worksheet.getSheetValues())
      .map(stringifyCellValue)
      .join(' ');

    expect(budgetWorksheet?.getCell('C2').value).toBe(1000);
    expect(budgetWorksheet?.getCell('D2').value).toBe(350);
    expect(budgetWorksheet?.getCell('E2').value).toBe(650);
    expect(allValues).not.toContain('passwordHash');
    expect(allValues).not.toContain('hash-secreto');
  });

  it('enforces export permissions and rejects users', async () => {
    await expect(service.generateProjectExcel(project.uuid, managerUser)).resolves.toMatchObject({
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await expect(service.generateProjectExcel(project.uuid, otherManagerUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.generateProjectExcel(project.uuid, regularUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects missing and soft deleted projects', async () => {
    project.deletedAt = new Date('2026-07-24T12:00:00.000Z');

    await expect(
      service.generateProjectPdf('99999999-9999-4999-8999-999999999998', adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.generateProjectPdf(project.uuid, adminUser)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

async function loadGeneratedWorkbook(
  service: ExportsService,
  projectUuid: string,
  currentUser: AuthenticatedUser,
): Promise<ExcelJS.Workbook> {
  const file = await service.generateProjectExcel(projectUuid, currentUser);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  expect(file.buffer.length).toBeGreaterThan(1000);
  expect(file.fileName).toMatch(/\.xlsx$/);

  return workbook;
}

function stringifyCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }

  return JSON.stringify(value);
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

function createUser(uuid: string, role: UserRole, name = 'Usuario'): User {
  return {
    uuid,
    email: `${uuid}@proplan.local`,
    name,
    role,
    isActive: true,
    passwordHash: 'hash-secreto',
    createdAt: new Date('2026-07-24T18:30:00.000Z'),
    updatedAt: new Date('2026-07-24T18:30:00.000Z'),
    managedProjects: [],
    projectMemberships: [],
    taskAssignments: [],
  };
}

function createProject(): Project {
  return {
    uuid: '99999999-9999-4999-8999-999999999999',
    name: 'Proyecto exportable',
    description: 'Reporte de proyecto.',
    objective: 'Validar exportaciones.',
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
  };
}

function createTask(overrides: Partial<Task>): Task {
  return {
    uuid: overrides.uuid ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    projectUuid: overrides.projectUuid ?? '99999999-9999-4999-8999-999999999999',
    parentTaskUuid: overrides.parentTaskUuid ?? null,
    name: overrides.name ?? 'Actividad',
    description: overrides.description ?? null,
    startDate: overrides.startDate ?? '2026-08-01',
    endDate: overrides.endDate ?? '2026-08-05',
    status: overrides.status ?? TaskStatus.IN_PROGRESS,
    progress: overrides.progress ?? 25,
    estimatedHours: overrides.estimatedHours ?? '16.00',
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
  isMainResponsible: boolean,
): TaskAssignment {
  return {
    uuid: `${taskUuid}-${userUuid}`,
    taskUuid,
    userUuid,
    assignedHours,
    isMainResponsible,
    task: createTask({ uuid: taskUuid }),
    user: createUser(userUuid, userUuid === managerUser.uuid ? UserRole.PROJECT_MANAGER : UserRole.USER),
  };
}

function createMember(projectUuid: string, userUuid: string): ProjectMember {
  return {
    uuid: `${projectUuid}-${userUuid}`,
    projectUuid,
    userUuid,
    joinedAt: new Date('2026-07-25T03:30:00.000Z'),
    project: createProject(),
    user: createUser(userUuid, userUuid === managerUser.uuid ? UserRole.PROJECT_MANAGER : UserRole.USER),
  };
}

class InMemoryProjectsRepository {
  constructor(private readonly projects: readonly Project[]) {}

  findOne(options: { where: Partial<Project> }): Promise<Project | null> {
    return Promise.resolve(
      this.projects.find((project) => matchesWhere(project, options.where) && project.deletedAt === null) ??
        null,
    );
  }
}

class InMemoryTasksRepository {
  constructor(private readonly tasks: readonly Task[]) {}

  find(options: { where: Partial<Task> }): Promise<Task[]> {
    return Promise.resolve(
      this.tasks.filter((task) => matchesWhere(task, options.where) && task.deletedAt === null),
    );
  }
}

class InMemoryTaskDependenciesRepository {
  constructor(private readonly dependencies: readonly TaskDependency[]) {}

  find(options: { where: Partial<TaskDependency> }): Promise<TaskDependency[]> {
    return Promise.resolve(
      this.dependencies.filter((dependency) => matchesWhere(dependency, options.where)),
    );
  }
}

class InMemoryTaskAssignmentsRepository {
  constructor(private readonly assignments: readonly TaskAssignment[]) {}

  find(options: { where: Partial<TaskAssignment> }): Promise<TaskAssignment[]> {
    return Promise.resolve(
      this.assignments.filter((assignment) => matchesWhere(assignment, options.where)),
    );
  }
}

class InMemoryProjectMembersRepository {
  constructor(private readonly members: readonly ProjectMember[]) {}

  find(options: { where: Partial<ProjectMember> }): Promise<ProjectMember[]> {
    return Promise.resolve(this.members.filter((member) => matchesWhere(member, options.where)));
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
    typeof value === 'object' &&
    value !== null &&
    '_value' in value &&
    Array.isArray(value._value)
  );
}
