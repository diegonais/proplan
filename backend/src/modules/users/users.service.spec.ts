import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { EnvironmentVariables } from '../../config/env.validation';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let repository: InMemoryUsersRepository;
  let projectsRepository: InMemoryProjectsRepository;
  let projectMembersRepository: InMemoryProjectMembersRepository;
  let taskAssignmentsRepository: InMemoryTaskAssignmentsRepository;
  let service: UsersService;

  beforeEach(() => {
    repository = new InMemoryUsersRepository();
    projectsRepository = new InMemoryProjectsRepository();
    projectMembersRepository = new InMemoryProjectMembersRepository();
    taskAssignmentsRepository = new InMemoryTaskAssignmentsRepository();
    service = new UsersService(
      repository as unknown as Repository<User>,
      projectsRepository as unknown as Repository<Project>,
      projectMembersRepository as unknown as Repository<ProjectMember>,
      taskAssignmentsRepository as unknown as Repository<TaskAssignment>,
      {
        get: () => 10,
      } as unknown as ConfigService<EnvironmentVariables, true>,
    );
  });

  it('creates users with hashed passwords and safe responses', async () => {
    const user = await service.create({
      name: 'Ana Perez',
      email: ' ANA@PROPLAN.LOCAL ',
      password: 'TemporalPassword123',
      role: UserRole.USER,
    });
    const storedUser = repository.users[0];

    expect(user).toMatchObject({
      name: 'Ana Perez',
      email: 'ana@proplan.local',
      role: UserRole.USER,
      isActive: true,
    });
    expect(user).not.toHaveProperty('passwordHash');
    expect(storedUser).toBeDefined();
    expect(storedUser?.passwordHash).not.toBe('TemporalPassword123');
    await expect(
      bcrypt.compare('TemporalPassword123', storedUser?.passwordHash ?? ''),
    ).resolves.toBe(true);
  });

  it('rejects duplicated emails', async () => {
    await service.create({
      name: 'Ana Perez',
      email: 'ana@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.USER,
    });

    await expect(
      service.create({
        name: 'Ana Duplicada',
        email: ' ANA@PROPLAN.LOCAL ',
        password: 'TemporalPassword123',
        role: UserRole.USER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates passwords by generating a new hash', async () => {
    const createdUser = await service.create({
      name: 'Ana Perez',
      email: 'ana@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.USER,
    });
    const originalHash = repository.users[0]?.passwordHash;

    await service.update(createdUser.uuid, { password: 'NewTemporalPassword123' });

    const updatedHash = repository.users[0]?.passwordHash;
    expect(updatedHash).toBeDefined();
    expect(updatedHash).not.toBe(originalHash);
    await expect(bcrypt.compare('NewTemporalPassword123', updatedHash ?? '')).resolves.toBe(true);
  });

  it('deactivates and activates users', async () => {
    const createdUser = await service.create({
      name: 'Usuario Normal',
      email: 'user@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.USER,
    });

    await expect(service.updateStatus(createdUser.uuid, false)).resolves.toMatchObject({
      isActive: false,
    });
    await expect(service.updateStatus(createdUser.uuid, true)).resolves.toMatchObject({
      isActive: true,
    });
  });

  it('prevents deactivating the last active administrator', async () => {
    const admin = await service.create({
      name: 'Administrador',
      email: 'admin@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.ADMIN,
    });

    await expect(service.updateStatus(admin.uuid, false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('prevents deactivating a project manager with active managed projects', async () => {
    const manager = await service.create({
      name: 'Jefe Proyecto',
      email: 'jefe@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.PROJECT_MANAGER,
    });
    projectsRepository.projects.push({
      uuid: randomUUID(),
      managerUuid: manager.uuid,
      status: ProjectStatus.IN_PROGRESS,
      deletedAt: null,
    });

    await expect(service.updateStatus(manager.uuid, false)).rejects.toThrow(
      'No se puede desactivar al usuario porque dirige proyectos en planificacion o ejecucion.',
    );
  });

  it('prevents deactivating a user who belongs to active projects', async () => {
    const user = await service.create({
      name: 'Usuario Proyecto',
      email: 'miembro@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.USER,
    });
    projectMembersRepository.members.push({
      userUuid: user.uuid,
      project: {
        status: ProjectStatus.PLANNING,
        deletedAt: null,
      },
    });

    await expect(service.updateStatus(user.uuid, false)).rejects.toThrow(
      'No se puede desactivar al usuario porque pertenece a proyectos activos.',
    );
  });

  it('prevents deactivating a user who has active task assignments', async () => {
    const user = await service.create({
      name: 'Usuario Actividad',
      email: 'actividad@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.USER,
    });
    taskAssignmentsRepository.assignments.push({
      userUuid: user.uuid,
      task: {
        status: TaskStatus.BLOCKED,
        deletedAt: null,
        project: {
          status: ProjectStatus.IN_PROGRESS,
          deletedAt: null,
        },
      },
    });

    await expect(service.updateStatus(user.uuid, false)).rejects.toThrow(
      'No se puede desactivar al usuario porque tiene actividades activas asignadas.',
    );
  });

  it('prevents changing the role of the last active administrator', async () => {
    const admin = await service.create({
      name: 'Administrador',
      email: 'admin@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.ADMIN,
    });

    await expect(service.updateRole(admin.uuid, UserRole.USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows deactivating one administrator when another active administrator remains', async () => {
    const firstAdmin = await service.create({
      name: 'Administrador Uno',
      email: 'admin1@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.ADMIN,
    });
    await service.create({
      name: 'Administrador Dos',
      email: 'admin2@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.ADMIN,
    });

    await expect(service.updateStatus(firstAdmin.uuid, false)).resolves.toMatchObject({
      isActive: false,
    });
  });

  it('does not duplicate the initial administrator seed', async () => {
    const firstRun = await service.createInitialAdmin({
      name: 'Administrador',
      email: 'admin@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.ADMIN,
    });
    const secondRun = await service.createInitialAdmin({
      name: 'Administrador',
      email: 'admin@proplan.local',
      password: 'TemporalPassword123',
      role: UserRole.ADMIN,
    });

    expect(firstRun).not.toBeNull();
    expect(secondRun).toBeNull();
    expect(repository.users).toHaveLength(1);
  });
});

class InMemoryUsersRepository {
  users: User[] = [];

  create(input: Partial<User>): User {
    return {
      uuid: input.uuid ?? randomUUID(),
      name: input.name ?? '',
      email: input.email ?? '',
      passwordHash: input.passwordHash ?? '',
      role: input.role ?? UserRole.USER,
      isActive: input.isActive ?? true,
      createdAt: input.createdAt ?? new Date('2026-07-24T18:30:00.000Z'),
      updatedAt: input.updatedAt ?? new Date('2026-07-24T18:30:00.000Z'),
      managedProjects: [],
      projectMemberships: [],
      taskAssignments: [],
      resourceAssignmentsCreated: [],
    };
  }

  save(user: User): Promise<User> {
    const existingIndex = this.users.findIndex((existingUser) => existingUser.uuid === user.uuid);

    user.updatedAt = new Date('2026-07-24T18:35:00.000Z');

    if (existingIndex === -1) {
      this.users.push(user);
      return Promise.resolve(user);
    }

    this.users[existingIndex] = user;
    return Promise.resolve(user);
  }

  findOne(options: { where: Partial<User> }): Promise<User | null> {
    return Promise.resolve(
      this.users.find((user) =>
        Object.entries(options.where).every(([key, value]) => user[key as keyof User] === value),
      ) ?? null,
    );
  }

  count(options: { where: Partial<User> }): Promise<number> {
    return Promise.resolve(
      this.users.filter((user) =>
        Object.entries(options.where).every(([key, value]) => user[key as keyof User] === value),
      ).length,
    );
  }
}

interface ProjectResponsibility {
  uuid: string;
  managerUuid: string;
  status: ProjectStatus;
  deletedAt: Date | null;
}

interface ProjectMembershipResponsibility {
  userUuid: string;
  project: {
    status: ProjectStatus;
    deletedAt: Date | null;
  };
}

interface TaskAssignmentResponsibility {
  userUuid: string;
  task: {
    status: TaskStatus;
    deletedAt: Date | null;
    project: {
      status: ProjectStatus;
      deletedAt: Date | null;
    };
  };
}

interface QueryParams {
  userUuid?: string;
  activeProjectStatuses?: readonly ProjectStatus[];
  activeTaskStatuses?: readonly TaskStatus[];
}

class InMemoryProjectsRepository {
  projects: ProjectResponsibility[] = [];

  createQueryBuilder(): InMemoryCountQueryBuilder {
    return new InMemoryCountQueryBuilder((params) =>
      this.projects.filter(
        (project) =>
          project.managerUuid === params.userUuid &&
          params.activeProjectStatuses?.includes(project.status) === true &&
          project.deletedAt === null,
      ).length,
    );
  }
}

class InMemoryProjectMembersRepository {
  members: ProjectMembershipResponsibility[] = [];

  createQueryBuilder(): InMemoryCountQueryBuilder {
    return new InMemoryCountQueryBuilder((params) =>
      this.members.filter(
        (member) =>
          member.userUuid === params.userUuid &&
          params.activeProjectStatuses?.includes(member.project.status) === true &&
          member.project.deletedAt === null,
      ).length,
    );
  }
}

class InMemoryTaskAssignmentsRepository {
  assignments: TaskAssignmentResponsibility[] = [];

  createQueryBuilder(): InMemoryCountQueryBuilder {
    return new InMemoryCountQueryBuilder((params) =>
      this.assignments.filter(
        (assignment) =>
          assignment.userUuid === params.userUuid &&
          params.activeTaskStatuses?.includes(assignment.task.status) === true &&
          assignment.task.deletedAt === null &&
          params.activeProjectStatuses?.includes(assignment.task.project.status) === true &&
          assignment.task.project.deletedAt === null,
      ).length,
    );
  }
}

class InMemoryCountQueryBuilder {
  private params: QueryParams = {};

  constructor(private readonly countFn: (params: QueryParams) => number) {}

  where(_condition: string, params?: QueryParams): this {
    this.mergeParams(params);
    return this;
  }

  andWhere(_condition: string, params?: QueryParams): this {
    this.mergeParams(params);
    return this;
  }

  innerJoin(): this {
    return this;
  }

  getCount(): Promise<number> {
    return Promise.resolve(this.countFn(this.params));
  }

  private mergeParams(params?: QueryParams): void {
    this.params = {
      ...this.params,
      ...params,
    };
  }
}
