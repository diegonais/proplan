export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type TaskDependencyType = 'FINISH_TO_START';

export interface Task {
  uuid: string;
  projectUuid: string;
  parentTaskUuid: string | null;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  estimatedHours: string;
  plannedBudget: string | null;
  actualCost: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPayload {
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  estimatedHours: number;
  plannedBudget: string;
  actualCost: string;
  parentTaskUuid?: string | null;
}

export interface TaskProgressPayload {
  status: TaskStatus;
  progress: number;
}

export interface TaskFormValues {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: string;
  estimatedHours: string;
  plannedBudget: string;
  actualCost: string;
  parentTaskUuid: string;
}

export interface TaskDependency {
  uuid: string;
  predecessorTaskUuid: string;
  successorTaskUuid: string;
  dependencyType: TaskDependencyType;
  predecessorTask: Task;
  successorTask: Task;
}

export interface TaskAssignmentUser {
  uuid: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'PROJECT_MANAGER' | 'USER';
  isActive: boolean;
}

export interface TaskAssignment {
  uuid: string;
  taskUuid: string;
  userUuid: string;
  assignedHours: string;
  isMainResponsible: boolean;
  user: TaskAssignmentUser;
}

export interface TaskDependenciesResponse {
  incoming: TaskDependency[];
  outgoing: TaskDependency[];
}

export const taskStatuses: readonly TaskStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
];

export function getTaskStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    PENDING: 'Pendiente',
    IN_PROGRESS: 'En progreso',
    BLOCKED: 'Bloqueada',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
  };

  return labels[status];
}

export function getTaskDependencyTypeLabel(type: TaskDependencyType): string {
  const labels: Record<TaskDependencyType, string> = {
    FINISH_TO_START: 'Fin a inicio',
  };

  return labels[type];
}
