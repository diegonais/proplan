import { ProjectFinancialSummary, ProjectStatus } from '../projects/types';
import {
  ResourceAssignmentTemporalStatus,
  ResourceCategory,
  ResourceOperationalStatus,
} from '../resources/types';
import { TaskDependencyType, TaskStatus } from '../tasks/types';
import { WorkloadItem } from '../team/types';

export type TrafficLightColor = 'GREEN' | 'YELLOW' | 'RED';

export interface OverdueTaskReportItem {
  uuid: string;
  name: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
}

export interface TrafficLightReport {
  color: TrafficLightColor;
  reasons: string[];
  today: string;
  totalActualCost: string;
  approvedBudget: string;
  consumedPercentage: string;
  overdueTasksPercentage: string;
  overdueTasksCount: number;
  activeNonCancelledTasksCount: number;
  isProjectOverdue: boolean;
  overdueTasks: OverdueTaskReportItem[];
  canViewFinancialDetails: boolean;
}

export interface GanttTaskReportItem {
  uuid: string;
  projectUuid: string;
  parentTaskUuid: string | null;
  name: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  level: number;
}

export interface GanttDependencyReportItem {
  uuid: string;
  predecessorTaskUuid: string;
  successorTaskUuid: string;
  dependencyType: TaskDependencyType;
}

export interface GanttReport {
  projectUuid: string;
  projectName: string;
  projectStartDate: string;
  projectEndDate: string;
  datePolicy: string;
  tasks: GanttTaskReportItem[];
  dependencies: GanttDependencyReportItem[];
}

export interface DashboardProjectSummary {
  projectUuid: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  progressPercentage: string;
  trafficLight: TrafficLightColor;
}

export interface DashboardMilestone {
  taskUuid: string;
  projectUuid: string;
  projectName: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
}

export interface DashboardReport {
  activeProjects: number;
  pendingTasks: number;
  visibleMembers: number;
  operationalResources: number;
  currentlyAssignedResources: number;
  resourcesInMaintenance: number;
  averageProgress: string;
  projectSummaries: DashboardProjectSummary[];
  upcomingMilestones: DashboardMilestone[];
  workload: WorkloadItem[];
  canViewFinancialDetails: boolean;
}

export interface TaskStatusCount {
  status: TaskStatus;
  count: number;
}

export interface ProjectStatusReport {
  projectUuid: string;
  projectName: string;
  projectStatus: ProjectStatus;
  startDate: string;
  endDate: string;
  progressPercentage: string;
  totalTasks: number;
  activeNonCancelledTasks: number;
  taskStatusCounts: TaskStatusCount[];
  trafficLight: TrafficLightReport;
}

export type ProjectBudgetReport = ProjectFinancialSummary;

export type ResourceCurrentAvailabilityStatus =
  'DISPONIBLE' | 'ASIGNADO' | 'NO_DISPONIBLE' | 'ELIMINADO';

export interface ResourceUtilizationProject {
  uuid: string;
  name: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
}

export interface ResourceUtilizationTask {
  uuid: string;
  name: string;
}

export interface ResourceCategorySummary {
  category: ResourceCategory;
  count: number;
}

export interface ResourceUtilizationSummary {
  totalAssignedResources: number;
  activeAssignments: number;
  scheduledAssignments: number;
  finishedAssignments: number;
  resourcesByCategory: ResourceCategorySummary[];
}

export interface ResourceUtilizationAssignment {
  uuid: string;
  projectUuid: string;
  resourceUuid: string;
  resourceName: string;
  resourceCode: string;
  resourceCategory: ResourceCategory;
  operationalStatus: ResourceOperationalStatus;
  task: ResourceUtilizationTask | null;
  startDate: string;
  endDate: string;
  temporalStatus: ResourceAssignmentTemporalStatus;
  assignedDays: number;
  currentAvailability: ResourceCurrentAvailabilityStatus;
  authorizedNotes: string | null;
}

export interface ResourceUtilizationReport {
  project: ResourceUtilizationProject;
  datePolicy: string;
  today: string;
  summary: ResourceUtilizationSummary;
  assignments: ResourceUtilizationAssignment[];
}

export type ResourcesReportTypeFilter = 'ALL' | 'HUMAN' | 'MATERIAL';

export type ResourcesReportItemType = 'HUMAN' | 'MATERIAL';

export interface ResourcesReportFilters {
  projectUuid: string | null;
  resourceType: ResourcesReportTypeFilter;
  month: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ResourcesReportSummary {
  totalHumanResources: number;
  totalMaterialResources: number;
  totalAssignedHours: string;
  totalMaterialAssignmentDays: number;
  activeMaterialAssignments: number;
}

export interface ResourcesReportItem {
  itemType: ResourcesReportItemType;
  projectUuid: string;
  projectName: string;
  user: WorkloadItem['user'] | null;
  resourceUuid: string | null;
  resourceName: string;
  resourceCode: string | null;
  resourceCategory: ResourceCategory | null;
  operationalStatus: ResourceOperationalStatus | null;
  assignedHours: string | null;
  assignedDays: number | null;
  taskName: string | null;
  startDate: string | null;
  endDate: string | null;
  temporalStatus: ResourceAssignmentTemporalStatus | null;
  currentAvailability: ResourceCurrentAvailabilityStatus | null;
  authorizedNotes: string | null;
}

export interface ResourcesReport {
  datePolicy: string;
  today: string;
  filters: ResourcesReportFilters;
  summary: ResourcesReportSummary;
  items: ResourcesReportItem[];
}

export function getTrafficLightLabel(color: TrafficLightColor): string {
  const labels: Record<TrafficLightColor, string> = {
    GREEN: 'Verde',
    YELLOW: 'Amarillo',
    RED: 'Rojo',
  };

  return labels[color];
}

export function getResourceCurrentAvailabilityStatusLabel(
  status: ResourceCurrentAvailabilityStatus,
): string {
  const labels: Record<ResourceCurrentAvailabilityStatus, string> = {
    DISPONIBLE: 'Disponible',
    ASIGNADO: 'Asignado',
    NO_DISPONIBLE: 'No disponible',
    ELIMINADO: 'Eliminado',
  };

  return labels[status];
}

export function getResourcesReportTypeFilterLabel(type: ResourcesReportTypeFilter): string {
  const labels: Record<ResourcesReportTypeFilter, string> = {
    ALL: 'Todos',
    HUMAN: 'Recursos humanos',
    MATERIAL: 'Recursos materiales',
  };

  return labels[type];
}

export function getResourcesReportItemTypeLabel(type: ResourcesReportItemType): string {
  const labels: Record<ResourcesReportItemType, string> = {
    HUMAN: 'Humano',
    MATERIAL: 'Material',
  };

  return labels[type];
}
