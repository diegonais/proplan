import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { UserRole } from '../../common/enums/user-role.enum';
import { EnvironmentVariables } from '../../config/env.validation';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let repository: InMemoryUsersRepository;
  let service: UsersService;

  beforeEach(() => {
    repository = new InMemoryUsersRepository();
    service = new UsersService(
      repository as unknown as Repository<User>,
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
    await expect(bcrypt.compare('TemporalPassword123', storedUser?.passwordHash ?? '')).resolves.toBe(
      true,
    );
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

    await expect(service.updateStatus(admin.uuid, false)).rejects.toBeInstanceOf(BadRequestException);
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
      ) ?? null
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
