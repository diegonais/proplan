import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { normalizeMoney } from '../../common/utils/decimal-money';
import {
  exceedsApprovedBudget,
  PROJECT_BUDGET_LIMIT_MESSAGE,
} from '../../common/utils/project-budget';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../task-dependencies/entities/task-dependency.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { UpdateOwnTaskProgressDto } from './dto/update-own-task-progress.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';

interface TaskSchedule {
  uuid: string;
  startDate: string;
  endDate: string;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    @InjectRepository(TaskDependency)
    private readonly taskDependenciesRepository: Repository<TaskDependency>,
    @InjectRepository(TaskAssignment)
    private readonly taskAssignmentsRepository: Repository<TaskAssignment>,
  ) {}

  async create(
    projectUuid: string,
    createTaskDto: CreateTaskDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    this.ensureCanManageProject(project, currentUser);
    this.ensureDateRangeIsValid(createTaskDto.startDate, createTaskDto.endDate);
    this.ensureStatusAndProgressAreConsistent(
      createTaskDto.status ?? TaskStatus.PENDING,
      createTaskDto.progress ?? 0,
    );
    this.ensureTaskIsInsideProject(project, createTaskDto.startDate, createTaskDto.endDate);

    const parentTask = await this.resolveParentTask(project.uuid, createTaskDto.parentTaskUuid ?? null);
    const plannedBudget = normalizeMoney(createTaskDto.plannedBudget ?? '0.00');
    const status = createTaskDto.status ?? TaskStatus.PENDING;

    if (parentTask !== null) {
      this.ensureTaskIsInsideParent(parentTask, createTaskDto.startDate, createTaskDto.endDate);
    }

    await this.ensureProjectPlannedBudgetLimit(project, {
      plannedBudget,
      status,
    });

    const task = await this.tasksRepository.save(
      this.tasksRepository.create({
        projectUuid: project.uuid,
        parentTaskUuid: parentTask?.uuid ?? null,
        name: createTaskDto.name.trim(),
        description: createTaskDto.description ?? null,
        startDate: createTaskDto.startDate,
        endDate: createTaskDto.endDate,
        status,
        progress: createTaskDto.progress ?? 0,
        estimatedHours: formatDecimal(createTaskDto.estimatedHours ?? 0),
        plannedBudget,
        actualCost: normalizeMoney(createTaskDto.actualCost ?? '0.00'),
      }),
    );

    return TaskResponseDto.fromEntity(task);
  }

  async findAll(projectUuid: string, currentUser: AuthenticatedUser): Promise<TaskResponseDto[]> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    await this.ensureCanAccessProject(project, currentUser);

    const tasks = await this.tasksRepository.find({
      where: { projectUuid: project.uuid },
      order: { startDate: 'ASC', endDate: 'ASC', name: 'ASC' },
    });

    const visibleTasks =
      currentUser.role === UserRole.USER
        ? await this.filterAssignedTasks(tasks, currentUser.uuid)
        : tasks;

    return visibleTasks.map((task) =>
      TaskResponseDto.fromEntity(task, this.canViewFinancials(project, currentUser)),
    );
  }

  async findOne(uuid: string, currentUser: AuthenticatedUser): Promise<TaskResponseDto> {
    const task = await this.findActiveTaskOrFail(uuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    await this.ensureCanAccessTask(task, project, currentUser);

    return TaskResponseDto.fromEntity(task, this.canViewFinancials(project, currentUser));
  }

  async update(
    uuid: string,
    updateTaskDto: UpdateTaskDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    const task = await this.findActiveTaskOrFail(uuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    this.ensureCanManageProject(project, currentUser);

    const nextStartDate = updateTaskDto.startDate ?? task.startDate;
    const nextEndDate = updateTaskDto.endDate ?? task.endDate;
    const nextStatus = updateTaskDto.status ?? task.status;
    const nextProgress = updateTaskDto.progress ?? task.progress;
    const nextPlannedBudget =
      updateTaskDto.plannedBudget === undefined
        ? task.plannedBudget
        : normalizeMoney(updateTaskDto.plannedBudget);
    const nextParentTaskUuid =
      updateTaskDto.parentTaskUuid === undefined ? task.parentTaskUuid : updateTaskDto.parentTaskUuid;

    this.ensureDateRangeIsValid(nextStartDate, nextEndDate);
    this.ensureStatusAndProgressAreConsistent(nextStatus, nextProgress);
    this.ensureTaskIsInsideProject(project, nextStartDate, nextEndDate);

    if (nextParentTaskUuid === task.uuid) {
      throw new BadRequestException('Una actividad no puede ser su propio padre.');
    }

    const parentTask = await this.resolveParentTask(project.uuid, nextParentTaskUuid ?? null);

    if (parentTask !== null) {
      this.ensureTaskIsInsideParent(parentTask, nextStartDate, nextEndDate);
      await this.ensureNoParentCycle(task.uuid, parentTask.uuid);
    }

    await this.ensureSubtasksRemainInsideTask(task.uuid, nextStartDate, nextEndDate);
    await this.ensureDependenciesRemainCompatible({
      uuid: task.uuid,
      startDate: nextStartDate,
      endDate: nextEndDate,
    });
    await this.ensureProjectPlannedBudgetLimit(project, {
      uuid: task.uuid,
      plannedBudget: nextPlannedBudget,
      status: nextStatus,
    });

    if (updateTaskDto.name !== undefined) {
      task.name = updateTaskDto.name.trim();
    }

    if (updateTaskDto.description !== undefined) {
      task.description = updateTaskDto.description;
    }

    if (updateTaskDto.startDate !== undefined) {
      task.startDate = updateTaskDto.startDate;
    }

    if (updateTaskDto.endDate !== undefined) {
      task.endDate = updateTaskDto.endDate;
    }

    if (updateTaskDto.status !== undefined) {
      task.status = updateTaskDto.status;
    }

    if (updateTaskDto.progress !== undefined) {
      task.progress = updateTaskDto.progress;
    }

    if (updateTaskDto.estimatedHours !== undefined) {
      task.estimatedHours = formatDecimal(updateTaskDto.estimatedHours);
    }

    if (updateTaskDto.plannedBudget !== undefined) {
      task.plannedBudget = nextPlannedBudget;
    }

    if (updateTaskDto.actualCost !== undefined) {
      task.actualCost = normalizeMoney(updateTaskDto.actualCost);
    }

    if (updateTaskDto.parentTaskUuid !== undefined) {
      task.parentTaskUuid = parentTask?.uuid ?? null;
    }

    const savedTask = await this.tasksRepository.save(task);

    return TaskResponseDto.fromEntity(savedTask, true);
  }

  async updateOwnProgress(
    uuid: string,
    updateOwnTaskProgressDto: UpdateOwnTaskProgressDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    const task = await this.findActiveTaskOrFail(uuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);

    if (currentUser.role !== UserRole.USER) {
      throw new ForbiddenException('Use el endpoint general para editar actividades con este rol.');
    }

    await this.ensureTaskAssignedToUser(task.uuid, currentUser.uuid);
    await this.ensureCanAccessProject(project, currentUser);
    this.ensureStatusAndProgressAreConsistent(
      updateOwnTaskProgressDto.status,
      updateOwnTaskProgressDto.progress,
    );

    task.status = updateOwnTaskProgressDto.status;
    task.progress = updateOwnTaskProgressDto.progress;

    const savedTask = await this.tasksRepository.save(task);

    return TaskResponseDto.fromEntity(savedTask, false);
  }

  async remove(uuid: string, currentUser: AuthenticatedUser): Promise<void> {
    const task = await this.findActiveTaskOrFail(uuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    this.ensureCanManageProject(project, currentUser);

    const activeSubtasks = await this.tasksRepository.count({
      where: { parentTaskUuid: task.uuid },
    });

    if (activeSubtasks > 0) {
      throw new BadRequestException(
        'No se puede eliminar una actividad con subactividades activas. Elimine o reasigne las subactividades primero.',
      );
    }

    await this.tasksRepository.softRemove(task);
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

  private async resolveParentTask(projectUuid: string, parentTaskUuid: string | null): Promise<Task | null> {
    if (parentTaskUuid === null) {
      return null;
    }

    const parentTask = await this.findActiveTaskOrFail(parentTaskUuid);

    if (parentTask.projectUuid !== projectUuid) {
      throw new BadRequestException('La subactividad debe pertenecer al mismo proyecto que su actividad padre.');
    }

    return parentTask;
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

    throw new ForbiddenException('No tiene permiso para consultar actividades de este proyecto.');
  }

  private async ensureCanAccessTask(
    task: Task,
    project: Project,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    if (currentUser.role === UserRole.USER) {
      await this.ensureTaskAssignedToUser(task.uuid, currentUser.uuid);
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar esta actividad.');
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

    throw new ForbiddenException('No tiene permiso para administrar actividades de este proyecto.');
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

  private async ensureTaskAssignedToUser(taskUuid: string, userUuid: string): Promise<void> {
    const assignmentCount = await this.taskAssignmentsRepository.count({
      where: { taskUuid, userUuid },
    });

    if (assignmentCount === 0) {
      throw new ForbiddenException('No puede modificar ni consultar actividades ajenas.');
    }
  }

  private async filterAssignedTasks(tasks: Task[], userUuid: string): Promise<Task[]> {
    if (tasks.length === 0) {
      return [];
    }

    const assignments = await this.taskAssignmentsRepository.find({
      where: { userUuid },
    });
    const assignedTaskUuids = new Set(assignments.map((assignment) => assignment.taskUuid));

    return tasks.filter((task) => assignedTaskUuids.has(task.uuid));
  }

  private ensureDateRangeIsValid(startDate: string, endDate: string): void {
    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
      throw new BadRequestException('Las fechas deben existir y usar el formato YYYY-MM-DD.');
    }

    if (endDate < startDate) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio.');
    }
  }

  private ensureTaskIsInsideProject(project: Project, startDate: string, endDate: string): void {
    if (startDate < project.startDate || endDate > project.endDate) {
      throw new BadRequestException('Las fechas de la actividad deben estar dentro del rango del proyecto.');
    }
  }

  private ensureTaskIsInsideParent(parentTask: Task, startDate: string, endDate: string): void {
    if (startDate < parentTask.startDate || endDate > parentTask.endDate) {
      throw new BadRequestException(
        'Las fechas de la subactividad deben estar dentro del rango de su actividad padre.',
      );
    }
  }

  private ensureStatusAndProgressAreConsistent(status: TaskStatus, progress: number): void {
    if (status === TaskStatus.COMPLETED && progress !== 100) {
      throw new BadRequestException('Una actividad COMPLETED debe tener progreso 100.');
    }
  }

  private async ensureNoParentCycle(taskUuid: string, parentTaskUuid: string): Promise<void> {
    let currentParentUuid: string | null = parentTaskUuid;

    while (currentParentUuid !== null) {
      if (currentParentUuid === taskUuid) {
        throw new BadRequestException('La jerarquia padre-hijo no puede formar ciclos.');
      }

      const parentTask = await this.tasksRepository.findOne({ where: { uuid: currentParentUuid } });
      currentParentUuid = parentTask?.parentTaskUuid ?? null;
    }
  }

  private async ensureSubtasksRemainInsideTask(
    taskUuid: string,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const subtasks = await this.tasksRepository.find({ where: { parentTaskUuid: taskUuid } });
    const invalidSubtask = subtasks.find(
      (subtask) => subtask.startDate < startDate || subtask.endDate > endDate,
    );

    if (invalidSubtask !== undefined) {
      throw new BadRequestException(
        'La actividad no puede dejar fuera de rango a una subactividad activa.',
      );
    }
  }

  private async ensureDependenciesRemainCompatible(nextTask: TaskSchedule): Promise<void> {
    const incomingDependencies = await this.taskDependenciesRepository.find({
      where: { successorTaskUuid: nextTask.uuid },
      relations: { predecessorTask: true, successorTask: true },
    });
    const outgoingDependencies = await this.taskDependenciesRepository.find({
      where: { predecessorTaskUuid: nextTask.uuid },
      relations: { predecessorTask: true, successorTask: true },
    });

    const invalidIncoming = incomingDependencies.some(
      (dependency) =>
        dependency.predecessorTask.deletedAt === null &&
        dependency.predecessorTask.endDate > nextTask.startDate,
    );

    if (invalidIncoming) {
      throw new BadRequestException(
        'La actividad sucesora no puede iniciar antes del fin de una predecesora.',
      );
    }

    const invalidOutgoing = outgoingDependencies.some(
      (dependency) =>
        dependency.successorTask.deletedAt === null &&
        nextTask.endDate > dependency.successorTask.startDate,
    );

    if (invalidOutgoing) {
      throw new BadRequestException(
        'Una actividad sucesora no puede iniciar antes del fin de esta actividad.',
      );
    }
  }

  private async ensureProjectPlannedBudgetLimit(
    project: Project,
    nextTask: { uuid?: string; plannedBudget: string; status: TaskStatus },
  ): Promise<void> {
    const tasks = await this.tasksRepository.find({ where: { projectUuid: project.uuid } });
    const plannedBudgets = tasks
      .filter((task) => task.uuid !== nextTask.uuid && task.status !== TaskStatus.CANCELLED)
      .map((task) => task.plannedBudget);

    if (nextTask.status !== TaskStatus.CANCELLED) {
      plannedBudgets.push(nextTask.plannedBudget);
    }

    if (exceedsApprovedBudget(project.approvedBudget, plannedBudgets)) {
      throw new BadRequestException(PROJECT_BUDGET_LIMIT_MESSAGE);
    }
  }
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
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
