import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { ProjectStatus } from '../../common/enums/project-status.enum';
import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectFinancialSummaryResponseDto } from '../finances/dto/financial-summary-response.dto';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { calculateTemporalStatus } from '../resource-assignments/dto/resource-assignment-response.dto';
import { ResourceAssignmentTemporalStatus } from '../resource-assignments/dto/resource-assignment-temporal-status.enum';
import { ResourceAssignment } from '../resource-assignments/entities/resource-assignment.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../task-dependencies/entities/task-dependency.entity';
import { Task } from '../tasks/entities/task.entity';
import {
  DashboardMilestoneResponseDto,
  DashboardProjectSummaryResponseDto,
  DashboardReportResponseDto,
} from './dto/dashboard-report-response.dto';
import {
  GanttDependencyReportItemResponseDto,
  GanttReportResponseDto,
} from './dto/gantt-report-response.dto';
import {
  ProjectStatusReportResponseDto,
  TaskStatusCountResponseDto,
} from './dto/project-status-report-response.dto';
import {
  ResourceCurrentAvailabilityStatus,
  ResourceUtilizationAssignmentResponseDto,
  ResourceUtilizationReportResponseDto,
} from './dto/resource-utilization-report-response.dto';
import {
  TrafficLightReportResponseDto,
  WorkloadReportItemResponseDto,
} from './dto/report-common.dto';
import {
  calculateTrafficLight,
  getTodayInLaPaz,
  TrafficLightCalculation,
} from './reports-calculations';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(TaskDependency)
    private readonly taskDependenciesRepository: Repository<TaskDependency>,
    @InjectRepository(TaskAssignment)
    private readonly taskAssignmentsRepository: Repository<TaskAssignment>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    @InjectRepository(ResourceAssignment)
    private readonly resourceAssignmentsRepository: Repository<ResourceAssignment>,
  ) {}

  async getDashboard(currentUser: AuthenticatedUser): Promise<DashboardReportResponseDto> {
    const projects = await this.findVisibleProjects(currentUser);
    const projectUuids = projects.map((project) => project.uuid);
    const tasks = await this.findVisibleTasks(projects, currentUser);
    const activeProjects = projects.filter((project) =>
      [ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS].includes(project.status),
    ).length;
    const activeTasks = tasks.filter((task) => task.status !== TaskStatus.CANCELLED);
    const pendingTasks = activeTasks.filter((task) => task.status === TaskStatus.PENDING).length;
    const workload = await this.getWorkloadForProjects(projectUuids);
    const visibleMembers = await this.countVisibleMembers(projectUuids);
    const today = getTodayInLaPaz();
    const tasksByProjectUuid = groupByProjectUuid(tasks);
    const projectSummaries = projects.map((project) =>
      this.buildDashboardProjectSummary(project, tasksByProjectUuid.get(project.uuid) ?? [], today),
    );

    return {
      activeProjects,
      pendingTasks,
      visibleMembers,
      averageProgress: calculateAverageProgress(activeTasks),
      projectSummaries,
      upcomingMilestones: this.buildUpcomingMilestones(projects, tasks, today),
      workload,
      canViewFinancialDetails: currentUser.role !== UserRole.USER,
    };
  }

  async getProjectGantt(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<GanttReportResponseDto> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    await this.ensureCanAccessProject(project, currentUser);
    const tasks = await this.findVisibleProjectTasks(project, currentUser);
    const taskUuids = tasks.map((task) => task.uuid);
    const visibleTaskUuids = new Set(taskUuids);
    const dependencies =
      taskUuids.length === 0
        ? []
        : await this.taskDependenciesRepository.find({
            where: {
              predecessorTaskUuid: In(taskUuids),
              successorTaskUuid: In(taskUuids),
            },
            order: { uuid: 'ASC' },
          });

    return {
      projectUuid: project.uuid,
      projectName: project.name,
      projectStartDate: project.startDate,
      projectEndDate: project.endDate,
      datePolicy: 'Las fechas se exponen como YYYY-MM-DD sin conversion de zona horaria.',
      tasks: flattenGanttTasks(tasks).map((item) => ({
        uuid: item.task.uuid,
        projectUuid: item.task.projectUuid,
        parentTaskUuid: item.task.parentTaskUuid,
        name: item.task.name,
        startDate: item.task.startDate,
        endDate: item.task.endDate,
        status: item.task.status,
        progress: item.task.progress,
        level: item.level,
      })),
      dependencies: dependencies
        .filter(
          (dependency) =>
            visibleTaskUuids.has(dependency.predecessorTaskUuid) &&
            visibleTaskUuids.has(dependency.successorTaskUuid),
        )
        .map((dependency) => this.mapGanttDependency(dependency)),
    };
  }

  async getProjectWorkload(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<WorkloadReportItemResponseDto[]> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    await this.ensureCanAccessProject(project, currentUser);

    return this.getWorkloadForProjects([project.uuid]);
  }

  async getProjectResourceUtilization(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<ResourceUtilizationReportResponseDto> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    await this.ensureCanAccessProject(project, currentUser);
    const today = getTodayInLaPaz();
    const assignments = await this.resourceAssignmentsRepository
      .createQueryBuilder('assignment')
      .withDeleted()
      .innerJoinAndSelect('assignment.resource', 'resource')
      .innerJoinAndSelect('assignment.project', 'project')
      .leftJoinAndSelect('assignment.task', 'task')
      .where('assignment.projectUuid = :projectUuid', { projectUuid: project.uuid })
      .andWhere('assignment.deletedAt IS NULL')
      .orderBy('assignment.startDate', 'ASC')
      .addOrderBy('assignment.endDate', 'ASC')
      .addOrderBy('resource.code', 'ASC')
      .getMany();
    const activeResourceUuids = await this.findCurrentlyAssignedResourceUuids(
      assignments.map((assignment) => assignment.resourceUuid),
      today,
    );
    const reportAssignments = assignments.map((assignment) =>
      this.mapResourceUtilizationAssignment(assignment, today, activeResourceUuids),
    );

    return {
      project: {
        uuid: project.uuid,
        name: project.name,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      datePolicy: 'Las fechas se exponen como YYYY-MM-DD sin conversion de zona horaria.',
      today,
      summary: buildResourceUtilizationSummary(reportAssignments),
      assignments: reportAssignments,
    };
  }

  async getProjectBudget(
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
      order: { startDate: 'ASC', endDate: 'ASC', name: 'ASC' },
    });

    return ProjectFinancialSummaryResponseDto.fromEntities(project, tasks);
  }

  async getProjectTrafficLight(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<TrafficLightReportResponseDto> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    await this.ensureCanAccessProject(project, currentUser);
    const tasks = await this.findVisibleProjectTasks(project, currentUser);
    const calculation = calculateTrafficLight(project, tasks, getTodayInLaPaz());

    return this.mapTrafficLight(calculation, this.canViewFinancials(project, currentUser));
  }

  async getProjectStatus(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<ProjectStatusReportResponseDto> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    await this.ensureCanAccessProject(project, currentUser);
    const tasks = await this.findVisibleProjectTasks(project, currentUser);
    const activeNonCancelledTasks = tasks.filter((task) => task.status !== TaskStatus.CANCELLED);
    const calculation = calculateTrafficLight(project, tasks, getTodayInLaPaz());

    return {
      projectUuid: project.uuid,
      projectName: project.name,
      projectStatus: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      progressPercentage: calculateAverageProgress(activeNonCancelledTasks),
      totalTasks: tasks.length,
      activeNonCancelledTasks: activeNonCancelledTasks.length,
      taskStatusCounts: this.buildTaskStatusCounts(tasks),
      trafficLight: this.mapTrafficLight(calculation, this.canViewFinancials(project, currentUser)),
    };
  }

  private async findVisibleProjects(currentUser: AuthenticatedUser): Promise<Project[]> {
    const queryBuilder = this.projectsRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.manager', 'manager')
      .orderBy('project.endDate', 'ASC')
      .addOrderBy('project.name', 'ASC');

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

    return queryBuilder.getMany();
  }

  private async findActiveProjectOrFail(uuid: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { uuid } });

    if (project === null) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private async findVisibleTasks(
    projects: readonly Project[],
    currentUser: AuthenticatedUser,
  ): Promise<Task[]> {
    const projectUuids = projects.map((project) => project.uuid);

    if (projectUuids.length === 0) {
      return [];
    }

    const tasks = await this.tasksRepository.find({
      where: { projectUuid: In(projectUuids) },
      order: { endDate: 'ASC', startDate: 'ASC', name: 'ASC' },
    });

    if (currentUser.role !== UserRole.USER || tasks.length === 0) {
      return tasks;
    }

    const assignments = await this.taskAssignmentsRepository.find({
      where: { userUuid: currentUser.uuid, taskUuid: In(tasks.map((task) => task.uuid)) },
    });
    const assignedTaskUuids = new Set(assignments.map((assignment) => assignment.taskUuid));

    return tasks.filter((task) => assignedTaskUuids.has(task.uuid));
  }

  private findVisibleProjectTasks(project: Project, currentUser: AuthenticatedUser): Promise<Task[]> {
    return this.findVisibleTasks([project], currentUser);
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

    if (currentUser.role === UserRole.USER && (await this.isProjectMember(project.uuid, currentUser.uuid))) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar reportes de este proyecto.');
  }

  private ensureCanViewFinancials(project: Project, currentUser: AuthenticatedUser): void {
    if (this.canViewFinancials(project, currentUser)) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar informacion financiera del proyecto.');
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

  private async countVisibleMembers(projectUuids: readonly string[]): Promise<number> {
    if (projectUuids.length === 0) {
      return 0;
    }

    const members = await this.projectMembersRepository.find({
      where: { projectUuid: In([...projectUuids]) },
    });

    return new Set(members.map((member) => member.userUuid)).size;
  }

  private async getWorkloadForProjects(
    projectUuids: readonly string[],
  ): Promise<WorkloadReportItemResponseDto[]> {
    if (projectUuids.length === 0) {
      return [];
    }

    const rows = await this.taskAssignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoin('assignment.task', 'task')
      .innerJoin('assignment.user', 'user')
      .select('task.projectUuid', 'projectUuid')
      .addSelect('assignment.userUuid', 'userUuid')
      .addSelect('user.uuid', 'user_uuid')
      .addSelect('user.name', 'user_name')
      .addSelect('user.email', 'user_email')
      .addSelect('user.role', 'user_role')
      .addSelect('COALESCE(SUM(assignment.assignedHours), 0)', 'assignedHours')
      .where('task.projectUuid IN (:...projectUuids)', { projectUuids })
      .andWhere('task.deletedAt IS NULL')
      .groupBy('task.projectUuid')
      .addGroupBy('assignment.userUuid')
      .addGroupBy('user.uuid')
      .addGroupBy('user.name')
      .addGroupBy('user.email')
      .addGroupBy('user.role')
      .orderBy('user.name', 'ASC')
      .getRawMany<{
        projectUuid: string;
        userUuid: string;
        user_uuid: string;
        user_name: string;
        user_email: string;
        user_role: UserRole;
        assignedHours: string;
      }>();

    return rows.map((row) => ({
      projectUuid: row.projectUuid,
      userUuid: row.userUuid,
      user: {
        uuid: row.user_uuid,
        name: row.user_name,
        email: row.user_email,
        role: row.user_role,
      },
      assignedHours: Number(row.assignedHours).toFixed(2),
    }));
  }

  private async findCurrentlyAssignedResourceUuids(
    resourceUuids: readonly string[],
    today: string,
  ): Promise<Set<string>> {
    const uniqueResourceUuids = Array.from(new Set(resourceUuids));

    if (uniqueResourceUuids.length === 0) {
      return new Set();
    }

    const activeAssignments = await this.resourceAssignmentsRepository.find({
      select: { resourceUuid: true, startDate: true, endDate: true },
      where: {
        resourceUuid: In(uniqueResourceUuids),
      },
    });

    return new Set(
      activeAssignments
        .filter((assignment) => assignment.startDate <= today && assignment.endDate >= today)
        .map((assignment) => assignment.resourceUuid),
    );
  }

  private mapResourceUtilizationAssignment(
    assignment: ResourceAssignment,
    today: string,
    activeResourceUuids: ReadonlySet<string>,
  ): ResourceUtilizationAssignmentResponseDto {
    return {
      uuid: assignment.uuid,
      projectUuid: assignment.projectUuid,
      resourceUuid: assignment.resourceUuid,
      resourceName: assignment.resource.name,
      resourceCode: assignment.resource.code,
      resourceCategory: assignment.resource.category,
      operationalStatus: assignment.resource.operationalStatus,
      task:
        assignment.task === null
          ? null
          : {
              uuid: assignment.task.uuid,
              name: assignment.task.name,
            },
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      temporalStatus: calculateTemporalStatus(assignment.startDate, assignment.endDate, today),
      assignedDays: calculateInclusiveDateDays(assignment.startDate, assignment.endDate),
      currentAvailability: resolveCurrentAvailability(assignment, activeResourceUuids),
      authorizedNotes: assignment.notes,
    };
  }

  private buildDashboardProjectSummary(
    project: Project,
    tasks: readonly Task[],
    today: string,
  ): DashboardProjectSummaryResponseDto {
    const calculation = calculateTrafficLight(project, tasks, today);

    return {
      projectUuid: project.uuid,
      name: project.name,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      progressPercentage: calculateAverageProgress(tasks.filter((task) => task.status !== TaskStatus.CANCELLED)),
      trafficLight: calculation.color,
    };
  }

  private buildUpcomingMilestones(
    projects: readonly Project[],
    tasks: readonly Task[],
    today: string,
  ): DashboardMilestoneResponseDto[] {
    const projectNameByUuid = new Map(projects.map((project) => [project.uuid, project.name]));

    return tasks
      .filter((task) => task.status !== TaskStatus.CANCELLED && task.endDate >= today)
      .sort((firstTask, secondTask) => {
        const endDateComparison = firstTask.endDate.localeCompare(secondTask.endDate);

        return endDateComparison === 0 ? firstTask.name.localeCompare(secondTask.name) : endDateComparison;
      })
      .slice(0, 6)
      .map((task) => ({
        taskUuid: task.uuid,
        projectUuid: task.projectUuid,
        projectName: projectNameByUuid.get(task.projectUuid) ?? 'Proyecto',
        name: task.name,
        startDate: task.startDate,
        endDate: task.endDate,
        progress: task.progress,
      }));
  }

  private buildTaskStatusCounts(tasks: readonly Task[]): TaskStatusCountResponseDto[] {
    return Object.values(TaskStatus).map((status) => ({
      status,
      count: tasks.filter((task) => task.status === status).length,
    }));
  }

  private mapTrafficLight(
    calculation: TrafficLightCalculation,
    canViewFinancialDetails: boolean,
  ): TrafficLightReportResponseDto {
    const financialReasons = new Set([
      'El costo ejecutado supera el presupuesto aprobado.',
      'El consumo del presupuesto esta entre 80% y 100%.',
    ]);

    return {
      color: calculation.color,
      reasons: canViewFinancialDetails
        ? calculation.reasons
        : calculation.reasons.map((reason) =>
            financialReasons.has(reason)
              ? 'Existe una condicion financiera del proyecto que requiere revision del responsable.'
              : reason,
          ),
      today: calculation.today,
      totalActualCost: canViewFinancialDetails ? calculation.totalActualCost : '0.00',
      approvedBudget: canViewFinancialDetails ? calculation.approvedBudget : '0.00',
      consumedPercentage: canViewFinancialDetails ? calculation.consumedPercentage : '0.00',
      overdueTasksPercentage: calculation.overdueTasksPercentage,
      overdueTasksCount: calculation.overdueTasksCount,
      activeNonCancelledTasksCount: calculation.activeNonCancelledTasksCount,
      isProjectOverdue: calculation.isProjectOverdue,
      overdueTasks: calculation.overdueTasks,
      canViewFinancialDetails,
    };
  }

  private mapGanttDependency(dependency: TaskDependency): GanttDependencyReportItemResponseDto {
    return {
      uuid: dependency.uuid,
      predecessorTaskUuid: dependency.predecessorTaskUuid,
      successorTaskUuid: dependency.successorTaskUuid,
      dependencyType: dependency.dependencyType,
    };
  }
}

function calculateAverageProgress(tasks: readonly Task[]): string {
  if (tasks.length === 0) {
    return '0.00';
  }

  const total = tasks.reduce((sum, task) => sum + task.progress, 0);

  return (total / tasks.length).toFixed(2);
}

function groupByProjectUuid(tasks: readonly Task[]): Map<string, Task[]> {
  const groupedTasks = new Map<string, Task[]>();

  tasks.forEach((task) => {
    const projectTasks = groupedTasks.get(task.projectUuid) ?? [];
    projectTasks.push(task);
    groupedTasks.set(task.projectUuid, projectTasks);
  });

  return groupedTasks;
}

function buildResourceUtilizationSummary(
  assignments: readonly ResourceUtilizationAssignmentResponseDto[],
): ResourceUtilizationReportResponseDto['summary'] {
  const resourceUuidsByCategory = new Map<
    ResourceUtilizationAssignmentResponseDto['resourceCategory'],
    Set<string>
  >();

  assignments.forEach((assignment) => {
    const resourceUuids = resourceUuidsByCategory.get(assignment.resourceCategory) ?? new Set<string>();
    resourceUuids.add(assignment.resourceUuid);
    resourceUuidsByCategory.set(assignment.resourceCategory, resourceUuids);
  });

  return {
    totalAssignedResources: new Set(assignments.map((assignment) => assignment.resourceUuid)).size,
    activeAssignments: assignments.filter(
      (assignment) => assignment.temporalStatus === ResourceAssignmentTemporalStatus.ACTIVE,
    ).length,
    scheduledAssignments: assignments.filter(
      (assignment) => assignment.temporalStatus === ResourceAssignmentTemporalStatus.SCHEDULED,
    ).length,
    finishedAssignments: assignments.filter(
      (assignment) => assignment.temporalStatus === ResourceAssignmentTemporalStatus.FINISHED,
    ).length,
    resourcesByCategory: Array.from(resourceUuidsByCategory.entries())
      .map(([category, resourceUuids]) => ({
        category,
        count: resourceUuids.size,
      }))
      .sort((firstCategory, secondCategory) =>
        firstCategory.category.localeCompare(secondCategory.category),
      ),
  };
}

function resolveCurrentAvailability(
  assignment: ResourceAssignment,
  activeResourceUuids: ReadonlySet<string>,
): ResourceCurrentAvailabilityStatus {
  if (assignment.resource.deletedAt !== null) {
    return ResourceCurrentAvailabilityStatus.DELETED;
  }

  if (
    !assignment.resource.isActive ||
    assignment.resource.operationalStatus !== ResourceOperationalStatus.OPERATIONAL
  ) {
    return ResourceCurrentAvailabilityStatus.UNAVAILABLE;
  }

  if (activeResourceUuids.has(assignment.resourceUuid)) {
    return ResourceCurrentAvailabilityStatus.ASSIGNED;
  }

  return ResourceCurrentAvailabilityStatus.AVAILABLE;
}

function calculateInclusiveDateDays(startDate: string, endDate: string): number {
  const startTime = parseDateOnlyUtcNoon(startDate).getTime();
  const endTime = parseDateOnlyUtcNoon(endDate).getTime();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((endTime - startTime) / millisecondsPerDay) + 1;
}

function parseDateOnlyUtcNoon(value: string): Date {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number.parseInt(yearText ?? '', 10);
  const month = Number.parseInt(monthText ?? '', 10);
  const day = Number.parseInt(dayText ?? '', 10);

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

interface FlattenedGanttTask {
  task: Task;
  level: number;
}

function flattenGanttTasks(tasks: readonly Task[]): FlattenedGanttTask[] {
  const childrenByParentUuid = new Map<string | null, Task[]>();

  tasks.forEach((task) => {
    const siblings = childrenByParentUuid.get(task.parentTaskUuid) ?? [];
    siblings.push(task);
    childrenByParentUuid.set(task.parentTaskUuid, siblings);
  });

  childrenByParentUuid.forEach((siblings) => {
    siblings.sort((firstTask, secondTask) => {
      const startComparison = firstTask.startDate.localeCompare(secondTask.startDate);

      return startComparison === 0 ? firstTask.name.localeCompare(secondTask.name) : startComparison;
    });
  });

  const flattenedTasks: FlattenedGanttTask[] = [];
  const visitedTaskUuids = new Set<string>();

  const visit = (parentTaskUuid: string | null, level: number) => {
    const children = childrenByParentUuid.get(parentTaskUuid) ?? [];

    children.forEach((task) => {
      if (visitedTaskUuids.has(task.uuid)) {
        return;
      }

      visitedTaskUuids.add(task.uuid);
      flattenedTasks.push({ task, level });
      visit(task.uuid, level + 1);
    });
  };

  visit(null, 0);

  tasks.forEach((task) => {
    if (!visitedTaskUuids.has(task.uuid)) {
      flattenedTasks.push({ task, level: 0 });
    }
  });

  return flattenedTasks;
}
