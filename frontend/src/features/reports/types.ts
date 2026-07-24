import { ProjectFinancialSummary, ProjectStatus } from '../projects/types';
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

export function getTrafficLightLabel(color: TrafficLightColor): string {
  const labels: Record<TrafficLightColor, string> = {
    GREEN: 'Verde',
    YELLOW: 'Amarillo',
    RED: 'Rojo',
  };

  return labels[color];
}
