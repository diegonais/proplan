import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { normalizeMoney } from '../../common/utils/decimal-money';
import {
  exceedsApprovedBudget,
  PROJECT_BUDGET_LIMIT_MESSAGE,
} from '../../common/utils/project-budget';
import { ProjectResponseDto } from '../projects/dto/project-response.dto';
import { Project } from '../projects/entities/project.entity';
import { TaskResponseDto } from '../tasks/dto/task-response.dto';
import { Task } from '../tasks/entities/task.entity';
import { ProjectFinancialSummaryResponseDto } from './dto/financial-summary-response.dto';
import { UpdateProjectBudgetDto } from './dto/update-project-budget.dto';
import { UpdateTaskFinancialsDto } from './dto/update-task-financials.dto';

@Injectable()
export class FinancesService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
  ) {}

  async getProjectFinancialSummary(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<ProjectFinancialSummaryResponseDto> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    this.ensureCanViewFinancials(project, currentUser);

    const tasks = await this.tasksRepository.find({
      where: {
        projectUuid: project.uuid,
        status: Not(TaskStatus.CANCELLED),
      },
      order: {
        startDate: 'ASC',
        endDate: 'ASC',
        name: 'ASC',
      },
    });

    return ProjectFinancialSummaryResponseDto.fromEntities(project, tasks);
  }

  async updateProjectBudget(
    projectUuid: string,
    updateProjectBudgetDto: UpdateProjectBudgetDto,
    currentUser: AuthenticatedUser,
  ): Promise<ProjectResponseDto> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    this.ensureCanManageFinancials(project, currentUser);
    this.ensureProjectCanBeModified(project);
    const approvedBudget = normalizeMoney(updateProjectBudgetDto.approvedBudget);

    await this.ensureApprovedBudgetCanCoverDistributedBudget(project.uuid, approvedBudget);

    project.approvedBudget = approvedBudget;
    const savedProject = await this.projectsRepository.save(project);
    const reloadedProject = await this.findActiveProjectOrFail(savedProject.uuid);

    return ProjectResponseDto.fromEntity(reloadedProject, true);
  }

  async updateTaskFinancials(
    taskUuid: string,
    updateTaskFinancialsDto: UpdateTaskFinancialsDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    if (
      updateTaskFinancialsDto.plannedBudget === undefined &&
      updateTaskFinancialsDto.actualCost === undefined
    ) {
      throw new BadRequestException('Debe enviar plannedBudget, actualCost o ambos.');
    }

    const task = await this.findActiveTaskOrFail(taskUuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    this.ensureCanManageFinancials(project, currentUser);
    this.ensureProjectCanBeModified(project);
    const nextPlannedBudget =
      updateTaskFinancialsDto.plannedBudget === undefined
        ? task.plannedBudget
        : normalizeMoney(updateTaskFinancialsDto.plannedBudget);

    await this.ensureProjectPlannedBudgetLimit(project, {
      uuid: task.uuid,
      plannedBudget: nextPlannedBudget,
      status: task.status,
    });

    if (updateTaskFinancialsDto.plannedBudget !== undefined) {
      task.plannedBudget = nextPlannedBudget;
    }

    if (updateTaskFinancialsDto.actualCost !== undefined) {
      task.actualCost = normalizeMoney(updateTaskFinancialsDto.actualCost);
    }

    const savedTask = await this.tasksRepository.save(task);

    return TaskResponseDto.fromEntity(savedTask);
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

  private async findActiveTaskOrFail(uuid: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { uuid } });

    if (task === null) {
      throw new NotFoundException('Actividad no encontrada.');
    }

    return task;
  }

  private ensureCanViewFinancials(project: Project, currentUser: AuthenticatedUser): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar informacion financiera del proyecto.');
  }

  private ensureCanManageFinancials(project: Project, currentUser: AuthenticatedUser): void {
    this.ensureCanViewFinancials(project, currentUser);
  }

  private ensureProjectCanBeModified(project: Project): void {
    if (project.status === ProjectStatus.COMPLETED) {
      throw new BadRequestException('No se puede modificar un proyecto finalizado.');
    }
  }

  private async ensureApprovedBudgetCanCoverDistributedBudget(
    projectUuid: string,
    approvedBudget: string,
  ): Promise<void> {
    const plannedBudgets = await this.getActivePlannedBudgets(projectUuid);

    if (exceedsApprovedBudget(approvedBudget, plannedBudgets)) {
      throw new BadRequestException(PROJECT_BUDGET_LIMIT_MESSAGE);
    }
  }

  private async ensureProjectPlannedBudgetLimit(
    project: Project,
    nextTask: { uuid: string; plannedBudget: string; status: TaskStatus },
  ): Promise<void> {
    const plannedBudgets = (await this.getActiveTasks(project.uuid))
      .filter((task) => task.uuid !== nextTask.uuid)
      .map((task) => task.plannedBudget);

    if (nextTask.status !== TaskStatus.CANCELLED) {
      plannedBudgets.push(nextTask.plannedBudget);
    }

    if (exceedsApprovedBudget(project.approvedBudget, plannedBudgets)) {
      throw new BadRequestException(PROJECT_BUDGET_LIMIT_MESSAGE);
    }
  }

  private async getActivePlannedBudgets(projectUuid: string): Promise<string[]> {
    return (await this.getActiveTasks(projectUuid)).map((task) => task.plannedBudget);
  }

  private async getActiveTasks(projectUuid: string): Promise<Task[]> {
    const tasks = await this.tasksRepository.find({
      where: {
        projectUuid,
        status: Not(TaskStatus.CANCELLED),
      },
    });

    return tasks;
  }
}
