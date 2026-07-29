import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';

import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ResourceAssignment } from '../resource-assignments/entities/resource-assignment.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ListResourcesQueryDto, ResourceSortField } from './dto/list-resources-query.dto';
import { PaginatedResourcesResponseDto } from './dto/paginated-resources-response.dto';
import { ResourceAvailabilityQueryDto } from './dto/resource-availability-query.dto';
import {
  ResourceAvailabilityConflictDto,
  ResourceAvailabilityResponseDto,
  ResourceUnavailableReason,
} from './dto/resource-availability-response.dto';
import { ResourceResponseDto } from './dto/resource-response.dto';
import { UpdateResourceStatusDto } from './dto/update-resource-status.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Resource } from './entities/resource.entity';

const UNIQUE_VIOLATION_CODE = '23505';
const LA_PAZ_TIME_ZONE = 'America/La_Paz';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private readonly resourcesRepository: Repository<Resource>,
    @InjectRepository(ResourceAssignment)
    private readonly resourceAssignmentsRepository: Repository<ResourceAssignment>,
  ) {}

  async create(createResourceDto: CreateResourceDto): Promise<ResourceResponseDto> {
    const code = normalizeCode(createResourceDto.code);
    await this.ensureCodeIsAvailable(code);

    const resource = this.resourcesRepository.create({
      name: createResourceDto.name.trim(),
      description: createResourceDto.description ?? null,
      code,
      category: createResourceDto.category,
      serialNumber: createResourceDto.serialNumber ?? null,
      operationalStatus:
        createResourceDto.operationalStatus ?? ResourceOperationalStatus.OPERATIONAL,
      notes: createResourceDto.notes ?? null,
      isActive: true,
    });

    return ResourceResponseDto.fromEntity(await this.saveHandlingUniqueCode(resource));
  }

  async findAll(query: ListResourcesQueryDto): Promise<PaginatedResourcesResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const queryBuilder = this.resourcesRepository
      .createQueryBuilder('resource')
      .andWhere('resource.deletedAt IS NULL');

    if (query.search !== undefined && query.search.length > 0) {
      const search = `%${query.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        new Brackets((builder) => {
          builder
            .where('lower(resource.name) LIKE :search', { search })
            .orWhere('lower(resource.code) LIKE :search', { search })
            .orWhere('lower(resource.serialNumber) LIKE :search', { search });
        }),
      );
    }

    if (query.category !== undefined) {
      queryBuilder.andWhere('resource.category = :category', { category: query.category });
    }

    if (query.operationalStatus !== undefined) {
      queryBuilder.andWhere('resource.operationalStatus = :operationalStatus', {
        operationalStatus: query.operationalStatus,
      });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('resource.isActive = :isActive', { isActive: query.isActive });
    }

    const [resources, total] = await queryBuilder
      .orderBy(resolveSortColumn(query.orderBy), query.order)
      .addOrderBy('resource.uuid', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: resources.map((resource) => ResourceResponseDto.fromEntity(resource)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(uuid: string): Promise<ResourceResponseDto> {
    return ResourceResponseDto.fromEntity(await this.findActiveResourceOrFail(uuid));
  }

  async update(uuid: string, updateResourceDto: UpdateResourceDto): Promise<ResourceResponseDto> {
    const resource = await this.findActiveResourceOrFail(uuid);

    if (updateResourceDto.code !== undefined) {
      const code = normalizeCode(updateResourceDto.code);
      await this.ensureCodeIsAvailable(code, uuid);
      resource.code = code;
    }

    if (updateResourceDto.name !== undefined) {
      resource.name = updateResourceDto.name.trim();
    }

    if (updateResourceDto.description !== undefined) {
      resource.description = updateResourceDto.description ?? null;
    }

    if (updateResourceDto.category !== undefined) {
      resource.category = updateResourceDto.category;
    }

    if (updateResourceDto.serialNumber !== undefined) {
      resource.serialNumber = updateResourceDto.serialNumber ?? null;
    }

    if (updateResourceDto.notes !== undefined) {
      resource.notes = updateResourceDto.notes ?? null;
    }

    return ResourceResponseDto.fromEntity(await this.saveHandlingUniqueCode(resource));
  }

  async updateStatus(
    uuid: string,
    updateResourceStatusDto: UpdateResourceStatusDto,
  ): Promise<ResourceResponseDto> {
    if (
      updateResourceStatusDto.operationalStatus === undefined &&
      updateResourceStatusDto.isActive === undefined
    ) {
      throw new BadRequestException('Debe enviar isActive u operationalStatus para actualizar.');
    }

    const resource = await this.findActiveResourceOrFail(uuid);
    const nextOperationalStatus =
      updateResourceStatusDto.operationalStatus ?? resource.operationalStatus;
    const nextIsActive = updateResourceStatusDto.isActive ?? resource.isActive;

    if (
      (resource.isActive && !nextIsActive) ||
      (resource.operationalStatus === ResourceOperationalStatus.OPERATIONAL &&
        nextOperationalStatus !== ResourceOperationalStatus.OPERATIONAL)
    ) {
      await this.ensureNoCurrentOrFutureAssignments(
        uuid,
        'El recurso tiene asignaciones actuales o futuras. Debe cancelarlas o modificarlas antes.',
      );
    }

    resource.operationalStatus = nextOperationalStatus;
    resource.isActive = nextIsActive;

    return ResourceResponseDto.fromEntity(await this.resourcesRepository.save(resource));
  }

  async remove(uuid: string): Promise<void> {
    const resource = await this.findActiveResourceOrFail(uuid);

    await this.ensureNoCurrentOrFutureAssignments(
      uuid,
      'No se puede eliminar logicamente un recurso con asignaciones actuales o futuras.',
    );
    await this.resourcesRepository.softRemove(resource);
  }

  async checkAvailability(
    uuid: string,
    query: ResourceAvailabilityQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResourceAvailabilityResponseDto> {
    ensureDateRangeIsValid(query.startDate, query.endDate);

    const resource = await this.resourcesRepository.findOne({
      where: { uuid },
      withDeleted: true,
    });

    if (resource === null) {
      throw new NotFoundException('Recurso no encontrado.');
    }

    if (resource.deletedAt !== null) {
      return buildAvailabilityResponse(resource, ResourceUnavailableReason.RESOURCE_DELETED, []);
    }

    if (!resource.isActive) {
      return buildAvailabilityResponse(resource, ResourceUnavailableReason.RESOURCE_INACTIVE, []);
    }

    if (resource.operationalStatus !== ResourceOperationalStatus.OPERATIONAL) {
      return buildAvailabilityResponse(
        resource,
        ResourceUnavailableReason.NON_OPERATIONAL_STATUS,
        [],
      );
    }

    const conflictingAssignments = await this.findOverlappingAssignments(
      uuid,
      query.startDate,
      query.endDate,
    );

    if (conflictingAssignments.length === 0) {
      return buildAvailabilityResponse(resource, null, []);
    }

    return buildAvailabilityResponse(
      resource,
      ResourceUnavailableReason.ASSIGNMENT_CONFLICT,
      this.filterVisibleConflicts(conflictingAssignments, currentUser),
    );
  }

  private async findActiveResourceOrFail(uuid: string): Promise<Resource> {
    const resource = await this.resourcesRepository.findOne({ where: { uuid } });

    if (resource === null) {
      throw new NotFoundException('Recurso no encontrado.');
    }

    return resource;
  }

  private async ensureCodeIsAvailable(code: string, ignoredUuid?: string): Promise<void> {
    const existingResource = await this.resourcesRepository.findOne({ where: { code } });

    if (existingResource !== null && existingResource.uuid !== ignoredUuid) {
      throw new ConflictException('El codigo de recurso ya esta registrado.');
    }
  }

  private async ensureNoCurrentOrFutureAssignments(
    resourceUuid: string,
    message: string,
  ): Promise<void> {
    const today = getTodayInLaPaz();
    const activeAssignments = await this.resourceAssignmentsRepository
      .createQueryBuilder('assignment')
      .where('assignment.resourceUuid = :resourceUuid', { resourceUuid })
      .andWhere('assignment.deletedAt IS NULL')
      .andWhere('assignment.endDate >= :today', { today })
      .getCount();

    if (activeAssignments > 0) {
      throw new BadRequestException(message);
    }
  }

  private async findOverlappingAssignments(
    resourceUuid: string,
    startDate: string,
    endDate: string,
  ): Promise<ResourceAssignment[]> {
    return this.resourceAssignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.project', 'project')
      .where('assignment.resourceUuid = :resourceUuid', { resourceUuid })
      .andWhere('assignment.deletedAt IS NULL')
      .andWhere('assignment.startDate <= :endDate', { endDate })
      .andWhere('assignment.endDate >= :startDate', { startDate })
      .orderBy('assignment.startDate', 'ASC')
      .addOrderBy('assignment.endDate', 'ASC')
      .getMany();
  }

  private filterVisibleConflicts(
    assignments: ResourceAssignment[],
    currentUser: AuthenticatedUser,
  ): ResourceAvailabilityConflictDto[] {
    if (currentUser.role === UserRole.ADMIN) {
      return assignments.map((assignment) => ResourceAvailabilityConflictDto.fromEntity(assignment));
    }

    if (currentUser.role !== UserRole.PROJECT_MANAGER) {
      throw new ForbiddenException('No tiene permiso para consultar la disponibilidad de recursos.');
    }

    return assignments
      .filter((assignment) => canProjectManagerViewAssignment(assignment, currentUser.uuid))
      .map((assignment) => ResourceAvailabilityConflictDto.fromEntity(assignment));
  }

  private async saveHandlingUniqueCode(resource: Resource): Promise<Resource> {
    try {
      return await this.resourcesRepository.save(resource);
    } catch (error) {
      if (error instanceof QueryFailedError && hasDatabaseCode(error, UNIQUE_VIOLATION_CODE)) {
        throw new ConflictException('El codigo de recurso ya esta registrado.');
      }

      throw error;
    }
  }
}

function buildAvailabilityResponse(
  resource: Resource,
  unavailableReason: ResourceUnavailableReason | null,
  conflicts: ResourceAvailabilityConflictDto[],
): ResourceAvailabilityResponseDto {
  return {
    resourceUuid: resource.uuid,
    available: unavailableReason === null,
    operationalStatus: resource.operationalStatus,
    unavailableReason,
    conflicts,
  };
}

function canProjectManagerViewAssignment(
  assignment: ResourceAssignment,
  managerUuid: string,
): boolean {
  return assignment.project.managerUuid === managerUuid;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function resolveSortColumn(sortField: ResourceSortField): string {
  const sortColumns: Record<ResourceSortField, string> = {
    [ResourceSortField.NAME]: 'resource.name',
    [ResourceSortField.CODE]: 'resource.code',
    [ResourceSortField.CATEGORY]: 'resource.category',
    [ResourceSortField.OPERATIONAL_STATUS]: 'resource.operationalStatus',
    [ResourceSortField.IS_ACTIVE]: 'resource.isActive',
    [ResourceSortField.CREATED_AT]: 'resource.createdAt',
  };

  return sortColumns[sortField];
}

function ensureDateRangeIsValid(startDate: string, endDate: string): void {
  if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
    throw new BadRequestException('Las fechas deben existir y usar el formato YYYY-MM-DD.');
  }

  if (endDate < startDate) {
    throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio.');
  }
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const dateParts = value.split('-').map(Number);
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function getTodayInLaPaz(): string {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: LA_PAZ_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = dateParts.find((part) => part.type === 'year')?.value;
  const month = dateParts.find((part) => part.type === 'month')?.value;
  const day = dateParts.find((part) => part.type === 'day')?.value;

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('No se pudo calcular la fecha actual en America/La_Paz.');
  }

  return `${year}-${month}-${day}`;
}

function hasDatabaseCode(error: { readonly driverError: unknown }, code: string): boolean {
  const driverError = error.driverError;

  if (typeof driverError !== 'object' || driverError === null || !('code' in driverError)) {
    return false;
  }

  return driverError.code === code;
}
