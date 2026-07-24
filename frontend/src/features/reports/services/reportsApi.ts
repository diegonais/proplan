import { httpClient } from '../../../services/http/httpClient';
import {
  DashboardReport,
  GanttReport,
  ProjectBudgetReport,
  ProjectStatusReport,
  TrafficLightReport,
} from '../types';
import { WorkloadItem } from '../../team/types';

export async function getDashboardReport(): Promise<DashboardReport> {
  const response = await httpClient.get<DashboardReport>('/reports/dashboard');

  return response.data;
}

export async function getProjectGanttReport(projectUuid: string): Promise<GanttReport> {
  const response = await httpClient.get<GanttReport>(`/projects/${projectUuid}/reports/gantt`);

  return response.data;
}

export async function getProjectWorkloadReport(projectUuid: string): Promise<WorkloadItem[]> {
  const response = await httpClient.get<WorkloadItem[]>(`/projects/${projectUuid}/reports/workload`);

  return response.data;
}

export async function getProjectBudgetReport(projectUuid: string): Promise<ProjectBudgetReport> {
  const response = await httpClient.get<ProjectBudgetReport>(`/projects/${projectUuid}/reports/budget`);

  return response.data;
}

export async function getProjectTrafficLightReport(projectUuid: string): Promise<TrafficLightReport> {
  const response = await httpClient.get<TrafficLightReport>(
    `/projects/${projectUuid}/reports/traffic-light`,
  );

  return response.data;
}

export async function getProjectStatusReport(projectUuid: string): Promise<ProjectStatusReport> {
  const response = await httpClient.get<ProjectStatusReport>(`/projects/${projectUuid}/reports/status`);

  return response.data;
}
