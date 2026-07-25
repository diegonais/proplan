import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { normalizeMoney } from '../../common/utils/decimal-money';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto, ProjectSortField } from './dto/list-projects-query.dto';
import { PaginatedProjectsResponseDto } from './dto/paginated-projects-response.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';

const MANAGER_ROLES = [UserRole.ADMIN, UserRole.PROJECT_MANAGER] as const;

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createProjectDto: CreateProjectDto,
    currentUser: AuthenticatedUser,
  ): Promise<ProjectResponseDto> {
    this.ensureCanCreate(currentUser, createProjectDto);
    this.ensureDateRangeIsValid(createProjectDto.startDate, createProjectDto.endDate);

    const managerUuid =
      currentUser.role === UserRole.PROJECT_MANAGER ? currentUser.uuid : createProjectDto.managerUuid;

    if (managerUuid === undefined) {
      throw new BadRequestException('Debe seleccionar un jefe de proyecto.');
    }

    await this.findValidManagerOrFail(managerUuid);

    const project = await this.dataSource.transaction(async (entityManager) => {
      const projectRepository = entityManager.getRepository(Project);
      const projectMemberRepository = entityManager.getRepository(ProjectMember);

      const savedProject = await projectRepository.save(
        projectRepository.create({
          name: createProjectDto.name.trim(),
          description: createProjectDto.description ?? null,
          objective: createProjectDto.objective.trim(),
          startDate: createProjectDto.startDate,
          endDate: createProjectDto.endDate,
          status: createProjectDto.status ?? ProjectStatus.PLANNING,
          approvedBudget: normalizeMoney(createProjectDto.approvedBudget ?? '0.00'),
          managerUuid,
        }),
      );

      await this.ensureManagerMembership(projectMemberRepository, savedProject.uuid, managerUuid);

      return projectRepository.findOneOrFail({
        where: { uuid: savedProject.uuid },
        relations: { manager: true },
      });
    });

    return ProjectResponseDto.fromEntity(project);
  }

  async findAll(
    query: ListProjectsQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedProjectsResponseDto> {
    if (query.managerUuid !== undefined && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solamente el Administrador puede filtrar por jefe de proyecto.');
    }

    if (query.orderBy === ProjectSortField.APPROVED_BUDGET && currentUser.role === UserRole.USER) {
      throw new ForbiddenException('El rol Usuario no puede ordenar por informacion financiera.');
    }

    const page = query.page;
    const limit = query.limit;
    const queryBuilder = this.projectsRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.manager', 'manager');

    if (query.search !== undefined && query.search.length > 0) {
      const search = `%${query.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        new Brackets((builder) => {
          builder.where('lower(project.name) LIKE :search', { search });
        }),
      );
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('project.status = :status', { status: query.status });
    }

    if (query.managerUuid !== undefined) {
      queryBuilder.andWhere('project.managerUuid = :managerUuid', { managerUuid: query.managerUuid });
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER) {
      queryBuilder.andWhere('project.managerUuid = :currentUserUuid', {
        currentUserUuid: currentUser.uuid,
      });
    }

    if (currentUser.role === UserRole.USER) {
      queryBuilder
        .innerJoin('project.members', 'member')
        .andWhere('member.userUuid = :currentUserUuid', { currentUserUuid: currentUser.uuid });
    }

    const [projects, total] = await queryBuilder
      .orderBy(resolveSortColumn(query.orderBy), query.order)
      .addOrderBy('project.uuid', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: projects.map((project) =>
        ProjectResponseDto.fromEntity(project, this.canViewFinancials(project, currentUser)),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(uuid: string, currentUser: AuthenticatedUser): Promise<ProjectResponseDto> {
    const project = await this.findActiveProjectOrFail(uuid);
    await this.ensureCanAccess(project, currentUser);

    return ProjectResponseDto.fromEntity(project, this.canViewFinancials(project, currentUser));
  }

  async update(
    uuid: string,
    updateProjectDto: UpdateProjectDto,
    currentUser: AuthenticatedUser,
  ): Promise<ProjectResponseDto> {
    const project = await this.findActiveProjectOrFail(uuid);
    this.ensureCanManage(project, currentUser);

    if (updateProjectDto.managerUuid !== undefined && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solamente el Administrador puede reasignar el jefe de proyecto.');
    }

    if (updateProjectDto.managerUuid !== undefined) {
      await this.findValidManagerOrFail(updateProjectDto.managerUuid);
      project.managerUuid = updateProjectDto.managerUuid;
    }

    const nextStartDate = updateProjectDto.startDate ?? project.startDate;
    const nextEndDate = updateProjectDto.endDate ?? project.endDate;
    this.ensureDateRangeIsValid(nextStartDate, nextEndDate);
    await this.ensureActivitiesRemainInsideProject(project.uuid, nextStartDate, nextEndDate);

    if (updateProjectDto.name !== undefined) {
      project.name = updateProjectDto.name.trim();
    }

    if (updateProjectDto.description !== undefined) {
      project.description = updateProjectDto.description;
    }

    if (updateProjectDto.objective !== undefined) {
      project.objective = updateProjectDto.objective.trim();
    }

    if (updateProjectDto.startDate !== undefined) {
      project.startDate = updateProjectDto.startDate;
    }

    if (updateProjectDto.endDate !== undefined) {
      project.endDate = updateProjectDto.endDate;
    }

    if (updateProjectDto.status !== undefined) {
      project.status = updateProjectDto.status;
    }

    if (updateProjectDto.approvedBudget !== undefined) {
      project.approvedBudget = normalizeMoney(updateProjectDto.approvedBudget);
    }

    const savedProject = await this.dataSource.transaction(async (entityManager) => {
      const projectRepository = entityManager.getRepository(Project);
      const projectMemberRepository = entityManager.getRepository(ProjectMember);
      const updatedProject = await projectRepository.save(project);

      await this.ensureManagerMembership(
        projectMemberRepository,
        updatedProject.uuid,
        updatedProject.managerUuid,
      );

      return updatedProject;
    });
    const reloadedProject = await this.findActiveProjectOrFail(savedProject.uuid);

    return ProjectResponseDto.fromEntity(
      reloadedProject,
      this.canViewFinancials(reloadedProject, currentUser),
    );
  }

  async remove(uuid: string, currentUser: AuthenticatedUser): Promise<void> {
    const project = await this.findActiveProjectOrFail(uuid);
    this.ensureCanManage(project, currentUser);

    await this.projectsRepository.softRemove(project);
  }

  private ensureCanCreate(
    currentUser: AuthenticatedUser,
    createProjectDto: CreateProjectDto,
  ): void {
    if (currentUser.role === UserRole.USER) {
      throw new ForbiddenException('El rol Usuario no puede crear proyectos.');
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && createProjectDto.managerUuid !== undefined) {
      throw new ForbiddenException('El Jefe de proyecto no puede asignar otro jefe al crear.');
    }
  }

  private async findValidManagerOrFail(uuid: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { uuid } });

    if (user === null) {
      throw new BadRequestException('El jefe de proyecto seleccionado no existe.');
    }

    if (!user.isActive) {
      throw new BadRequestException('El jefe de proyecto seleccionado no esta activo.');
    }

    if (!MANAGER_ROLES.includes(user.role as (typeof MANAGER_ROLES)[number])) {
      throw new BadRequestException('El jefe de proyecto debe tener rol Administrador o Jefe de proyecto.');
    }

    return user;
  }

  private async findActiveProjectOrFail(uuid: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { uuid },
      relations: { manager: true },
    });

    if (project === null) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private async ensureCanAccess(project: Project, currentUser: AuthenticatedUser): Promise<void> {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    if (currentUser.role === UserRole.USER && (await this.isProjectMember(project.uuid, currentUser.uuid))) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar este proyecto.');
  }

  private ensureCanManage(project: Project, currentUser: AuthenticatedUser): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para administrar este proyecto.');
  }

  private canViewFinancials(project: Project, currentUser: AuthenticatedUser): boolean {
    return (
      currentUser.role === UserRole.ADMIN ||
      (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid)
    );
  }

  private async isProjectMember(projectUuid: string, userUuid: string): Promise<boolean> {
    const membershipCount = await this.projectMembersRepository.count({
      where: { projectUuid, userUuid },
    });

    return membershipCount > 0;
  }

  private async ensureManagerMembership(
    projectMemberRepository: Repository<ProjectMember>,
    projectUuid: string,
    managerUuid: string,
  ): Promise<void> {
    const existingMembership = await projectMemberRepository.findOne({
      where: {
        projectUuid,
        userUuid: managerUuid,
      },
    });

    if (existingMembership !== null) {
      return;
    }

    await projectMemberRepository.save(
      projectMemberRepository.create({
        projectUuid,
        userUuid: managerUuid,
      }),
    );
  }

  private ensureDateRangeIsValid(startDate: string, endDate: string): void {
    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
      throw new BadRequestException('Las fechas deben existir y usar el formato YYYY-MM-DD.');
    }

    if (endDate < startDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio.');
    }
  }

  private async ensureActivitiesRemainInsideProject(
    projectUuid: string,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const tasks = await this.tasksRepository.find({
      where: { projectUuid },
      order: { startDate: 'ASC', endDate: 'ASC', name: 'ASC' },
    });
    const taskOutsideRange = tasks.find((task) => task.startDate < startDate || task.endDate > endDate);

    if (taskOutsideRange !== undefined) {
      throw new BadRequestException(
        `El proyecto no puede dejar fuera de rango a la actividad "${taskOutsideRange.name}".`,
      );
    }
  }
}

function resolveSortColumn(sortField: ProjectSortField): string {
  const sortColumns: Record<ProjectSortField, string> = {
    [ProjectSortField.NAME]: 'project.name',
    [ProjectSortField.START_DATE]: 'project.startDate',
    [ProjectSortField.END_DATE]: 'project.endDate',
    [ProjectSortField.STATUS]: 'project.status',
    [ProjectSortField.APPROVED_BUDGET]: 'project.approvedBudget',
    [ProjectSortField.CREATED_AT]: 'project.createdAt',
  };

  return sortColumns[sortField];
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
