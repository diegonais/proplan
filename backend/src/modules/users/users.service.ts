import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Brackets, QueryFailedError, Repository } from 'typeorm';

import { UserRole } from '../../common/enums/user-role.enum';
import { EnvironmentVariables } from '../../config/env.validation';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto, UserSortField } from './dto/list-users-query.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const email = normalizeEmail(createUserDto.email);
    await this.ensureEmailIsAvailable(email);

    const user = this.usersRepository.create({
      name: createUserDto.name.trim(),
      email,
      passwordHash: await this.hashPassword(createUserDto.password),
      role: createUserDto.role,
      isActive: true,
    });

    return UserResponseDto.fromEntity(await this.saveHandlingUniqueEmail(user));
  }

  async findAll(query: ListUsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (query.search !== undefined && query.search.length > 0) {
      const search = `%${query.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        new Brackets((builder) => {
          builder
            .where('lower(user.name) LIKE :search', { search })
            .orWhere('lower(user.email) LIKE :search', { search });
        }),
      );
    }

    if (query.role !== undefined) {
      queryBuilder.andWhere('user.role = :role', { role: query.role });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    const [users, total] = await queryBuilder
      .orderBy(resolveSortColumn(query.orderBy), query.order)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: users.map((user) => UserResponseDto.fromEntity(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(uuid: string): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.findEntityOrFail(uuid));
  }

  async update(uuid: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.findEntityOrFail(uuid);

    if (updateUserDto.email !== undefined) {
      const email = normalizeEmail(updateUserDto.email);
      await this.ensureEmailIsAvailable(email, uuid);
      user.email = email;
    }

    if (updateUserDto.name !== undefined) {
      user.name = updateUserDto.name.trim();
    }

    if (updateUserDto.password !== undefined) {
      user.passwordHash = await this.hashPassword(updateUserDto.password);
    }

    return UserResponseDto.fromEntity(await this.saveHandlingUniqueEmail(user));
  }

  async updateStatus(uuid: string, isActive: boolean): Promise<UserResponseDto> {
    const user = await this.findEntityOrFail(uuid);

    if (!isActive && user.isActive && user.role === UserRole.ADMIN) {
      await this.ensureAtLeastOneOtherActiveAdmin();
    }

    user.isActive = isActive;

    return UserResponseDto.fromEntity(await this.usersRepository.save(user));
  }

  async updateRole(uuid: string, role: UserRole): Promise<UserResponseDto> {
    const user = await this.findEntityOrFail(uuid);

    if (user.isActive && user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      await this.ensureAtLeastOneOtherActiveAdmin();
    }

    user.role = role;

    return UserResponseDto.fromEntity(await this.usersRepository.save(user));
  }

  async findByEmailForAuthentication(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: normalizeEmail(email) } });
  }

  async findActiveByUuidForAuthentication(uuid: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { uuid, isActive: true } });
  }

  async createInitialAdmin(input: CreateUserDto): Promise<UserResponseDto | null> {
    const email = normalizeEmail(input.email);
    const existingUser = await this.usersRepository.findOne({ where: { email } });

    if (existingUser !== null) {
      return null;
    }

    const user = this.usersRepository.create({
      name: input.name.trim(),
      email,
      passwordHash: await this.hashPassword(input.password),
      role: UserRole.ADMIN,
      isActive: true,
    });

    return UserResponseDto.fromEntity(await this.saveHandlingUniqueEmail(user));
  }

  private async findEntityOrFail(uuid: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { uuid } });

    if (user === null) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return user;
  }

  private async ensureEmailIsAvailable(email: string, ignoredUuid?: string): Promise<void> {
    const existingUser = await this.usersRepository.findOne({ where: { email } });

    if (existingUser !== null && existingUser.uuid !== ignoredUuid) {
      throw new ConflictException('El email ya está registrado.');
    }
  }

  private async ensureAtLeastOneOtherActiveAdmin(): Promise<void> {
    const activeAdmins = await this.usersRepository.count({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    if (activeAdmins <= 1) {
      throw new BadRequestException('El sistema debe conservar al menos un Administrador activo.');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get('BCRYPT_SALT_ROUNDS', { infer: true });

    return bcrypt.hash(password, saltRounds);
  }

  private async saveHandlingUniqueEmail(user: User): Promise<User> {
    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (error instanceof QueryFailedError && hasDatabaseCode(error, UNIQUE_VIOLATION_CODE)) {
        throw new ConflictException('El email ya está registrado.');
      }

      throw error;
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveSortColumn(sortField: UserSortField): string {
  const sortColumns: Record<UserSortField, string> = {
    [UserSortField.NAME]: 'user.name',
    [UserSortField.EMAIL]: 'user.email',
    [UserSortField.ROLE]: 'user.role',
    [UserSortField.IS_ACTIVE]: 'user.isActive',
    [UserSortField.CREATED_AT]: 'user.createdAt',
  };

  return sortColumns[sortField];
}

function hasDatabaseCode(error: { readonly driverError: unknown }, code: string): boolean {
  const driverError = error.driverError;

  if (typeof driverError !== 'object' || driverError === null || !('code' in driverError)) {
    return false;
  }

  return driverError.code === code;
}
