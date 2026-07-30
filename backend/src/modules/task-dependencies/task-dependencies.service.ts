import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskDependencyType } from '../../common/enums/task-dependency-type.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import {
  TaskDependenciesResponseDto,
  TaskDependencyResponseDto,
} from './dto/task-dependency-response.dto';
import { TaskDependency } from './entities/task-dependency.entity';

@Injectable()
export class TaskDependenciesService {
  constructor(
    @InjectRepository(TaskDependency)
    private readonly taskDependenciesRepository: Repository<TaskDependency>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
  ) {}

  async create(
    successorTaskUuid: string,
    createDependencyDto: CreateTaskDependencyDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskDependencyResponseDto> {
    const dependencyType =
      createDependencyDto.dependencyType ?? TaskDependencyType.FINISH_TO_START;

    if (createDependencyDto.predecessorTaskUuid === successorTaskUuid) {
      throw new BadRequestException('Una actividad no puede depender de si misma.');
    }

    const successorTask = await this.findActiveTaskOrFail(successorTaskUuid);
    const predecessorTask = await this.findActiveTaskOrFail(createDependencyDto.predecessorTaskUuid);
    const project = await this.findActiveProjectOrFail(successorTask.projectUuid);
    this.ensureCanManageProject(project, currentUser);
    this.ensureProjectCanBeModified(project);

    if (predecessorTask.projectUuid !== successorTask.projectUuid) {
      throw new BadRequestException(
        'La actividad predecesora y la sucesora deben pertenecer al mismo proyecto.',
      );
    }

    if (successorTask.startDate < predecessorTask.endDate) {
      throw new BadRequestException(
        'En una dependencia fin a inicio, la sucesora no puede iniciar antes del fin de la predecesora.',
      );
    }

    const existingDependency = await this.taskDependenciesRepository.findOne({
      where: {
        predecessorTaskUuid: predecessorTask.uuid,
        successorTaskUuid: successorTask.uuid,
        dependencyType,
      },
    });

    if (existingDependency !== null) {
      throw new BadRequestException('La dependencia indicada ya existe.');
    }

    if (await this.wouldCreateDependencyCycle(predecessorTask.uuid, successorTask.uuid)) {
      throw new BadRequestException('Las dependencias no pueden formar ciclos.');
    }

    const dependency = await this.taskDependenciesRepository.save(
      this.taskDependenciesRepository.create({
        predecessorTaskUuid: predecessorTask.uuid,
        successorTaskUuid: successorTask.uuid,
        dependencyType,
      }),
    );

    dependency.predecessorTask = predecessorTask;
    dependency.successorTask = successorTask;

    return TaskDependencyResponseDto.fromEntity(dependency);
  }

  async findByTask(
    taskUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<TaskDependenciesResponseDto> {
    const task = await this.findActiveTaskOrFail(taskUuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    await this.ensureCanAccessProject(project, currentUser);

    const incoming = await this.taskDependenciesRepository.find({
      where: { successorTaskUuid: task.uuid },
      relations: { predecessorTask: true, successorTask: true },
      order: { uuid: 'ASC' },
    });
    const outgoing = await this.taskDependenciesRepository.find({
      where: { predecessorTaskUuid: task.uuid },
      relations: { predecessorTask: true, successorTask: true },
      order: { uuid: 'ASC' },
    });

    return {
      incoming: incoming
        .filter((dependency) => dependency.predecessorTask.deletedAt === null)
        .map((dependency) => TaskDependencyResponseDto.fromEntity(dependency)),
      outgoing: outgoing
        .filter((dependency) => dependency.successorTask.deletedAt === null)
        .map((dependency) => TaskDependencyResponseDto.fromEntity(dependency)),
    };
  }

  async remove(uuid: string, currentUser: AuthenticatedUser): Promise<void> {
    const dependency = await this.taskDependenciesRepository.findOne({
      where: { uuid },
      relations: { predecessorTask: true, successorTask: true },
    });

    if (dependency?.successorTask.deletedAt !== null) {
      throw new NotFoundException('Dependencia no encontrada.');
    }

    const project = await this.findActiveProjectOrFail(dependency.successorTask.projectUuid);
    this.ensureCanManageProject(project, currentUser);
    this.ensureProjectCanBeModified(project);

    await this.taskDependenciesRepository.remove(dependency);
  }

  private async findActiveProjectOrFail(uuid: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { uuid } });

    if (project === null) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private async findActiveTaskOrFail(uuid: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { uuid } });

    if (task === null) {
      throw new NotFoundException('Actividad no encontrada.');
    }

    return task;
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

    if (await this.isProjectMember(project.uuid, currentUser.uuid)) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar dependencias de este proyecto.');
  }

  private ensureCanManageProject(
    project: Project,
    currentUser: AuthenticatedUser,
  ): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para administrar dependencias de este proyecto.');
  }

  private ensureProjectCanBeModified(project: Project): void {
    if (project.status === ProjectStatus.COMPLETED) {
      throw new BadRequestException('No se puede modificar un proyecto finalizado.');
    }
  }

  private async isProjectMember(projectUuid: string, userUuid: string): Promise<boolean> {
    const membershipCount = await this.projectMembersRepository.count({
      where: { projectUuid, userUuid },
    });

    return membershipCount > 0;
  }

  private async wouldCreateDependencyCycle(
    predecessorTaskUuid: string,
    successorTaskUuid: string,
  ): Promise<boolean> {
    const visitedTaskUuids = new Set<string>();
    const stack = [successorTaskUuid];

    while (stack.length > 0) {
      const currentTaskUuid = stack.pop();

      if (currentTaskUuid === undefined || visitedTaskUuids.has(currentTaskUuid)) {
        continue;
      }

      if (currentTaskUuid === predecessorTaskUuid) {
        return true;
      }

      visitedTaskUuids.add(currentTaskUuid);

      const outgoingDependencies = await this.taskDependenciesRepository.find({
        where: { predecessorTaskUuid: currentTaskUuid },
      });

      stack.push(...outgoingDependencies.map((dependency) => dependency.successorTaskUuid));
    }

    return false;
  }
}
