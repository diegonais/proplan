import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';

import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { ResourceResponseDto } from '../resources/dto/resource-response.dto';
import { Resource } from '../resources/entities/resource.entity';
import { Task } from '../tasks/entities/task.entity';
import { AvailableResourcesQueryDto } from './dto/available-resources-query.dto';
import { CreateResourceAssignmentDto } from './dto/create-resource-assignment.dto';
import { ListResourceAssignmentsQueryDto } from './dto/list-resource-assignments-query.dto';
import {
  ResourceAssignmentResponseDto,
  calculateTemporalStatus,
} from './dto/resource-assignment-response.dto';
import { ResourceAssignmentTemporalStatus } from './dto/resource-assignment-temporal-status.enum';
import { UpdateResourceAssignmentDto } from './dto/update-resource-assignment.dto';
import { ResourceAssignment } from './entities/resource-assignment.entity';

const LA_PAZ_TIME_ZONE = 'America/La_Paz';
const EXCLUSION_VIOLATION_CODE = '23P01';
const RESOURCE_ASSIGNMENT_OVERLAP_CONSTRAINT = 'EX_resource_assignments_no_active_overlap';

interface AssignmentConflictPayload {
  message: string;
  resource: {
    uuid: string;
    name: string;
    code: string;
  };
  requestedStartDate: string;
  requestedEndDate: string;
  reason: 'ASSIGNMENT_CONFLICT';
  conflict?: {
    uuid: string;
    projectUuid: string;
    taskUuid: string | null;
    startDate: string;
    endDate: string;
  };
}

@Injectable()
export class ResourceAssignmentsService {
  constructor(
    @InjectRepository(ResourceAssignment)
    private readonly resourceAssignmentsRepository: Repository<ResourceAssignment>,
    @InjectRepository(Resource)
    private readonly resourcesRepository: Repository<Resource>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    projectUuid: string,
    createResourceAssignmentDto: CreateResourceAssignmentDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResourceAssignmentResponseDto> {
    ensureDateRangeIsValid(
      createResourceAssignmentDto.startDate,
      createResourceAssignmentDto.endDate,
    );

    try {
      return await this.dataSource.transaction(async (entityManager) => {
        const project = await this.findActiveProjectOrFail(entityManager, projectUuid);
        this.ensureCanManageProject(project, currentUser);

        const resource = await this.findAssignableResourceWithLockOrFail(
          entityManager,
          createResourceAssignmentDto.resourceUuid,
        );
        const task = await this.resolveTaskOrFail(
          entityManager,
          project.uuid,
          createResourceAssignmentDto.taskUuid ?? null,
        );

        this.ensureAssignmentIsInsideProject(
          project,
          createResourceAssignmentDto.startDate,
          createResourceAssignmentDto.endDate,
        );
        this.ensureAssignmentIsInsideTask(
          task,
          createResourceAssignmentDto.startDate,
          createResourceAssignmentDto.endDate,
        );

        await this.ensureNoOverlappingAssignment(
          entityManager,
          resource,
          createResourceAssignmentDto.startDate,
          createResourceAssignmentDto.endDate,
          currentUser,
        );

        const assignmentRepository = entityManager.getRepository(ResourceAssignment);
        const assignment = await assignmentRepository.save(
          assignmentRepository.create({
            resourceUuid: resource.uuid,
            projectUuid: project.uuid,
            taskUuid: task?.uuid ?? null,
            startDate: createResourceAssignmentDto.startDate,
            endDate: createResourceAssignmentDto.endDate,
            assignedByUuid: currentUser.uuid,
            notes: createResourceAssignmentDto.notes ?? null,
          }),
        );

        return ResourceAssignmentResponseDto.fromEntity(
          await this.findAssignmentWithRelationsOrFail(entityManager, assignment.uuid),
          getTodayInLaPaz(),
        );
      });
    } catch (error) {
      this.throwReadableConflictOnOverlap(
        error,
        createResourceAssignmentDto.resourceUuid,
        createResourceAssignmentDto.startDate,
        createResourceAssignmentDto.endDate,
      );
      throw error;
    }
  }

  async findAll(
    projectUuid: string,
    query: ListResourceAssignmentsQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResourceAssignmentResponseDto[]> {
    this.ensureQueryDateRangeIsValid(query.startDate, query.endDate);

    const project = await this.findActiveProjectOrFail(this.dataSource.manager, projectUuid);
    await this.ensureCanAccessProject(project, currentUser);

    const today = getTodayInLaPaz();
    const queryBuilder = this.resourceAssignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.resource', 'resource')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('assignment.task', 'task')
      .innerJoinAndSelect('assignment.assignedBy', 'assignedBy')
      .where('assignment.projectUuid = :projectUuid', { projectUuid: project.uuid })
      .andWhere('assignment.deletedAt IS NULL');

    if (query.resourceUuid !== undefined) {
      queryBuilder.andWhere('assignment.resourceUuid = :resourceUuid', {
        resourceUuid: query.resourceUuid,
      });
    }

    if (query.category !== undefined) {
      queryBuilder.andWhere('resource.category = :category', { category: query.category });
    }

    if (query.taskUuid !== undefined) {
      queryBuilder.andWhere('assignment.taskUuid = :taskUuid', { taskUuid: query.taskUuid });
    }

    if (query.temporalStatus !== undefined) {
      applyTemporalStatusFilter(queryBuilder, query.temporalStatus, today);
    }

    if (query.startDate !== undefined && query.endDate !== undefined) {
      queryBuilder
        .andWhere('assignment.startDate <= :endDate', { endDate: query.endDate })
        .andWhere('assignment.endDate >= :startDate', { startDate: query.startDate });
    } else if (query.startDate !== undefined) {
      queryBuilder.andWhere('assignment.endDate >= :startDate', { startDate: query.startDate });
    } else if (query.endDate !== undefined) {
      queryBuilder.andWhere('assignment.startDate <= :endDate', { endDate: query.endDate });
    }

    const assignments = await queryBuilder
      .orderBy('assignment.startDate', 'ASC')
      .addOrderBy('assignment.endDate', 'ASC')
      .addOrderBy('resource.code', 'ASC')
      .getMany();

    return assignments.map((assignment) => ResourceAssignmentResponseDto.fromEntity(assignment, today));
  }

  async findOne(
    uuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<ResourceAssignmentResponseDto> {
    const assignment = await this.findAssignmentWithRelationsOrFail(this.dataSource.manager, uuid);
    const project = await this.findActiveProjectOrFail(this.dataSource.manager, assignment.projectUuid);
    await this.ensureCanAccessProject(project, currentUser);

    return ResourceAssignmentResponseDto.fromEntity(assignment, getTodayInLaPaz());
  }

  async update(
    uuid: string,
    updateResourceAssignmentDto: UpdateResourceAssignmentDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResourceAssignmentResponseDto> {
    let requestedResourceUuid = updateResourceAssignmentDto.resourceUuid ?? 'desconocido';
    let requestedStartDate = updateResourceAssignmentDto.startDate ?? 'desconocida';
    let requestedEndDate = updateResourceAssignmentDto.endDate ?? 'desconocida';

    try {
      return await this.dataSource.transaction(async (entityManager) => {
        const assignment = await this.findAssignmentWithLockOrFail(entityManager, uuid);
        const currentProject = await this.findActiveProjectOrFail(
          entityManager,
          assignment.projectUuid,
        );
        this.ensureCanManageProject(currentProject, currentUser);

        const nextResourceUuid = updateResourceAssignmentDto.resourceUuid ?? assignment.resourceUuid;
        const nextStartDate = updateResourceAssignmentDto.startDate ?? assignment.startDate;
        const nextEndDate = updateResourceAssignmentDto.endDate ?? assignment.endDate;
        const nextTaskUuid =
          updateResourceAssignmentDto.taskUuid === undefined
            ? assignment.taskUuid
            : updateResourceAssignmentDto.taskUuid;
        requestedResourceUuid = nextResourceUuid;
        requestedStartDate = nextStartDate;
        requestedEndDate = nextEndDate;

        ensureDateRangeIsValid(nextStartDate, nextEndDate);

        const resource = await this.findAssignableResourceWithLockOrFail(
          entityManager,
          nextResourceUuid,
        );
        const task = await this.resolveTaskOrFail(entityManager, currentProject.uuid, nextTaskUuid);

        this.ensureAssignmentIsInsideProject(currentProject, nextStartDate, nextEndDate);
        this.ensureAssignmentIsInsideTask(task, nextStartDate, nextEndDate);

        await this.ensureNoOverlappingAssignment(
          entityManager,
          resource,
          nextStartDate,
          nextEndDate,
          currentUser,
          assignment.uuid,
        );

        assignment.resourceUuid = resource.uuid;
        assignment.taskUuid = task?.uuid ?? null;
        assignment.startDate = nextStartDate;
        assignment.endDate = nextEndDate;

        if (updateResourceAssignmentDto.notes !== undefined) {
          assignment.notes = updateResourceAssignmentDto.notes ?? null;
        }

        await entityManager.getRepository(ResourceAssignment).save(assignment);

        return ResourceAssignmentResponseDto.fromEntity(
          await this.findAssignmentWithRelationsOrFail(entityManager, assignment.uuid),
          getTodayInLaPaz(),
        );
      });
    } catch (error) {
      this.throwReadableConflictOnOverlap(
        error,
        requestedResourceUuid,
        requestedStartDate,
        requestedEndDate,
      );
      throw error;
    }
  }

  async remove(uuid: string, currentUser: AuthenticatedUser): Promise<void> {
    await this.dataSource.transaction(async (entityManager) => {
      const assignment = await this.findAssignmentWithLockOrFail(entityManager, uuid);
      const project = await this.findActiveProjectOrFail(entityManager, assignment.projectUuid);
      this.ensureCanManageProject(project, currentUser);

      await entityManager.getRepository(ResourceAssignment).softRemove(assignment);
    });
  }

  async findAvailableResources(
    projectUuid: string,
    query: AvailableResourcesQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<ResourceResponseDto[]> {
    ensureDateRangeIsValid(query.startDate, query.endDate);

    const project = await this.findActiveProjectOrFail(this.dataSource.manager, projectUuid);
    this.ensureCanManageProject(project, currentUser);
    const task = await this.resolveTaskOrFail(
      this.dataSource.manager,
      project.uuid,
      query.taskUuid ?? null,
    );

    this.ensureAssignmentIsInsideProject(project, query.startDate, query.endDate);
    this.ensureAssignmentIsInsideTask(task, query.startDate, query.endDate);

    const resources = await this.resourcesRepository
      .createQueryBuilder('resource')
      .where('resource.deletedAt IS NULL')
      .andWhere('resource.isActive = true')
      .andWhere('resource.operationalStatus = :operationalStatus', {
        operationalStatus: ResourceOperationalStatus.OPERATIONAL,
      })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM "resource_assignments" "overlap"
          WHERE "overlap"."resourceUuid" = resource.uuid
            AND "overlap"."deletedAt" IS NULL
            AND "overlap"."startDate" <= :endDate
            AND "overlap"."endDate" >= :startDate
        )`,
        {
          startDate: query.startDate,
          endDate: query.endDate,
        },
      )
      .orderBy('resource.code', 'ASC')
      .addOrderBy('resource.name', 'ASC')
      .getMany();

    return resources.map((resource) => ResourceResponseDto.fromEntity(resource));
  }

  private async findActiveProjectOrFail(
    entityManager: EntityManager,
    uuid: string,
  ): Promise<Project> {
    const project = await entityManager.getRepository(Project).findOne({ where: { uuid } });

    if (project === null) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private async findAssignableResourceWithLockOrFail(
    entityManager: EntityManager,
    uuid: string,
  ): Promise<Resource> {
    const resource = await entityManager.getRepository(Resource).findOne({
      where: { uuid },
      withDeleted: true,
      lock: { mode: 'pessimistic_write' },
    });

    if (resource === null) {
      throw new NotFoundException('Recurso no encontrado.');
    }

    if (resource.deletedAt !== null) {
      throw new BadRequestException('No se puede asignar un recurso eliminado.');
    }

    if (!resource.isActive) {
      throw new BadRequestException('No se puede asignar un recurso inactivo.');
    }

    if (resource.operationalStatus !== ResourceOperationalStatus.OPERATIONAL) {
      throw new BadRequestException('Solo se pueden asignar recursos en estado OPERATIONAL.');
    }

    return resource;
  }

  private async resolveTaskOrFail(
    entityManager: EntityManager,
    projectUuid: string,
    taskUuid: string | null,
  ): Promise<Task | null> {
    if (taskUuid === null) {
      return null;
    }

    const task = await entityManager.getRepository(Task).findOne({ where: { uuid: taskUuid } });

    if (task === null) {
      throw new NotFoundException('Actividad no encontrada.');
    }

    if (task.projectUuid !== projectUuid) {
      throw new BadRequestException('La actividad debe pertenecer al mismo proyecto.');
    }

    return task;
  }

  private async findAssignmentWithLockOrFail(
    entityManager: EntityManager,
    uuid: string,
  ): Promise<ResourceAssignment> {
    const assignment = await entityManager.getRepository(ResourceAssignment).findOne({
      where: { uuid },
      lock: { mode: 'pessimistic_write' },
    });

    if (assignment === null) {
      throw new NotFoundException('Asignacion de recurso no encontrada.');
    }

    return assignment;
  }

  private async findAssignmentWithRelationsOrFail(
    entityManager: EntityManager,
    uuid: string,
  ): Promise<ResourceAssignment> {
    const assignment = await entityManager.getRepository(ResourceAssignment).findOne({
      where: { uuid },
      relations: {
        resource: true,
        project: true,
        task: true,
        assignedBy: true,
      },
    });

    if (assignment === null) {
      throw new NotFoundException('Asignacion de recurso no encontrada.');
    }

    return assignment;
  }

  private async ensureNoOverlappingAssignment(
    entityManager: EntityManager,
    resource: Resource,
    startDate: string,
    endDate: string,
    currentUser: AuthenticatedUser,
    ignoredAssignmentUuid?: string,
  ): Promise<void> {
    const queryBuilder = entityManager
      .getRepository(ResourceAssignment)
      .createQueryBuilder('assignment')
      .setLock('pessimistic_write')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('assignment.task', 'task')
      .where('assignment.resourceUuid = :resourceUuid', { resourceUuid: resource.uuid })
      .andWhere('assignment.deletedAt IS NULL')
      .andWhere('assignment.startDate <= :endDate', { endDate })
      .andWhere('assignment.endDate >= :startDate', { startDate });

    if (ignoredAssignmentUuid !== undefined) {
      queryBuilder.andWhere('assignment.uuid <> :ignoredAssignmentUuid', {
        ignoredAssignmentUuid,
      });
    }

    const conflict = await queryBuilder
      .orderBy('assignment.startDate', 'ASC')
      .addOrderBy('assignment.endDate', 'ASC')
      .getOne();

    if (conflict !== null) {
      throw new ConflictException(
        buildConflictPayload(resource, startDate, endDate, conflict, currentUser),
      );
    }
  }

  private ensureAssignmentIsInsideProject(
    project: Project,
    startDate: string,
    endDate: string,
  ): void {
    if (startDate < project.startDate || endDate > project.endDate) {
      throw new BadRequestException('Las fechas de asignacion deben estar dentro del rango del proyecto.');
    }
  }

  private ensureAssignmentIsInsideTask(
    task: Task | null,
    startDate: string,
    endDate: string,
  ): void {
    if (task !== null && (startDate < task.startDate || endDate > task.endDate)) {
      throw new BadRequestException('Las fechas de asignacion deben estar dentro del rango de la actividad.');
    }
  }

  private async ensureCanAccessProject(
    project: Project,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    if (
      currentUser.role === UserRole.USER &&
      (await this.isProjectMember(project.uuid, currentUser.uuid))
    ) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar asignaciones de este proyecto.');
  }

  private ensureCanManageProject(project: Project, currentUser: AuthenticatedUser): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para administrar asignaciones de este proyecto.');
  }

  private async isProjectMember(projectUuid: string, userUuid: string): Promise<boolean> {
    const membershipCount = await this.projectMembersRepository.count({
      where: { projectUuid, userUuid },
    });

    return membershipCount > 0;
  }

  private ensureQueryDateRangeIsValid(startDate?: string, endDate?: string): void {
    if (startDate !== undefined && !isValidDateOnly(startDate)) {
      throw new BadRequestException('Las fechas deben existir y usar el formato YYYY-MM-DD.');
    }

    if (endDate !== undefined && !isValidDateOnly(endDate)) {
      throw new BadRequestException('Las fechas deben existir y usar el formato YYYY-MM-DD.');
    }

    if (startDate !== undefined && endDate !== undefined && endDate < startDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio.');
    }
  }

  private throwReadableConflictOnOverlap(
    error: unknown,
    resourceUuid: string,
    startDate: string,
    endDate: string,
  ): void {
    if (
      error instanceof QueryFailedError &&
      hasDatabaseCode(error, EXCLUSION_VIOLATION_CODE) &&
      hasDatabaseConstraint(error, RESOURCE_ASSIGNMENT_OVERLAP_CONSTRAINT)
    ) {
      throw new ConflictException({
        message: 'El recurso ya tiene una asignacion que se superpone con las fechas solicitadas.',
        resource: {
          uuid: resourceUuid,
          name: null,
          code: null,
        },
        requestedStartDate: startDate,
        requestedEndDate: endDate,
        reason: 'ASSIGNMENT_CONFLICT',
      });
    }
  }
}

function applyTemporalStatusFilter(
  queryBuilder: SelectQueryBuilder<ResourceAssignment>,
  temporalStatus: ResourceAssignmentTemporalStatus,
  today: string,
): void {
  if (temporalStatus === ResourceAssignmentTemporalStatus.FINISHED) {
    queryBuilder.andWhere('assignment.endDate < :today', { today });
    return;
  }

  if (temporalStatus === ResourceAssignmentTemporalStatus.SCHEDULED) {
    queryBuilder.andWhere('assignment.startDate > :today', { today });
    return;
  }

  queryBuilder
    .andWhere('assignment.startDate <= :today', { today })
    .andWhere('assignment.endDate >= :today', { today });
}

function buildConflictPayload(
  resource: Resource,
  startDate: string,
  endDate: string,
  conflict: ResourceAssignment,
  currentUser: AuthenticatedUser,
): AssignmentConflictPayload {
  const payload: AssignmentConflictPayload = {
    message: 'El recurso ya tiene una asignacion que se superpone con las fechas solicitadas.',
    resource: {
      uuid: resource.uuid,
      name: resource.name,
      code: resource.code,
    },
    requestedStartDate: startDate,
    requestedEndDate: endDate,
    reason: 'ASSIGNMENT_CONFLICT',
  };

  if (canViewConflictProject(conflict, currentUser)) {
    payload.conflict = {
      uuid: conflict.uuid,
      projectUuid: conflict.projectUuid,
      taskUuid: conflict.taskUuid,
      startDate: conflict.startDate,
      endDate: conflict.endDate,
    };
  }

  return payload;
}

function canViewConflictProject(
  conflict: ResourceAssignment,
  currentUser: AuthenticatedUser,
): boolean {
  if (currentUser.role === UserRole.ADMIN) {
    return true;
  }

  return (
    currentUser.role === UserRole.PROJECT_MANAGER &&
    conflict.project.managerUuid === currentUser.uuid
  );
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

export function getTodayInLaPaz(): string {
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

function hasDatabaseConstraint(
  error: { readonly driverError: unknown },
  constraint: string,
): boolean {
  const driverError = error.driverError;

  if (typeof driverError !== 'object' || driverError === null || !('constraint' in driverError)) {
    return false;
  }

  return driverError.constraint === constraint;
}

export { calculateTemporalStatus };
