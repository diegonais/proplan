import { UserRole } from '../auth/types';

export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ProjectManager {
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Project {
  uuid: string;
  name: string;
  description: string | null;
  objective: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  approvedBudget: string;
  managerUuid: string;
  manager: ProjectManager;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFormValues {
  name: string;
  description: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  approvedBudget: string;
  managerUuid: string;
}

export interface ProjectPayload {
  name: string;
  description?: string | null;
  objective: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  approvedBudget: number;
  managerUuid?: string;
}

export interface ProjectsListParams {
  page: number;
  limit: number;
  search?: string;
  status?: ProjectStatus;
  managerUuid?: string;
  orderBy?: 'name' | 'startDate' | 'endDate' | 'status' | 'approvedBudget' | 'createdAt';
  order?: 'ASC' | 'DESC';
}

export interface PaginatedProjectsResponse {
  data: Project[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ManagerOption {
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
}

export const projectStatuses: readonly ProjectStatus[] = [
  'PLANNING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export function getProjectStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    PLANNING: 'Planificacion',
    IN_PROGRESS: 'En ejecucion',
    COMPLETED: 'Finalizado',
    CANCELLED: 'Cancelado',
  };

  return labels[status];
}
