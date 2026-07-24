import { httpClient } from '../../../services/http/httpClient';
import {
  Task,
  TaskAssignment,
  TaskDependenciesResponse,
  TaskDependency,
  TaskPayload,
  TaskProgressPayload,
} from '../types';

export async function listProjectTasks(projectUuid: string): Promise<Task[]> {
  const response = await httpClient.get<Task[]>(`/projects/${projectUuid}/tasks`);

  return response.data;
}

export async function createTask(projectUuid: string, payload: TaskPayload): Promise<Task> {
  const response = await httpClient.post<Task>(`/projects/${projectUuid}/tasks`, payload);

  return response.data;
}

export async function updateTask(taskUuid: string, payload: TaskPayload): Promise<Task> {
  const response = await httpClient.patch<Task>(`/tasks/${taskUuid}`, payload);

  return response.data;
}

export async function updateOwnTaskProgress(
  taskUuid: string,
  payload: TaskProgressPayload,
): Promise<Task> {
  const response = await httpClient.patch<Task>(`/tasks/${taskUuid}/my-progress`, payload);

  return response.data;
}

export async function deleteTask(taskUuid: string): Promise<void> {
  await httpClient.delete(`/tasks/${taskUuid}`);
}

export async function listTaskDependencies(taskUuid: string): Promise<TaskDependenciesResponse> {
  const response = await httpClient.get<TaskDependenciesResponse>(`/tasks/${taskUuid}/dependencies`);

  return response.data;
}

export async function createTaskDependency(
  successorTaskUuid: string,
  predecessorTaskUuid: string,
): Promise<TaskDependency> {
  const response = await httpClient.post<TaskDependency>(`/tasks/${successorTaskUuid}/dependencies`, {
    predecessorTaskUuid,
    dependencyType: 'FINISH_TO_START',
  });

  return response.data;
}

export async function deleteTaskDependency(dependencyUuid: string): Promise<void> {
  await httpClient.delete(`/task-dependencies/${dependencyUuid}`);
}

export async function listTaskAssignments(taskUuid: string): Promise<TaskAssignment[]> {
  const response = await httpClient.get<TaskAssignment[]>(`/tasks/${taskUuid}/assignments`);

  return response.data;
}

export interface TaskAssignmentPayload {
  userUuid: string;
  assignedHours: number;
  isMainResponsible?: boolean;
}

export async function createTaskAssignment(
  taskUuid: string,
  payload: TaskAssignmentPayload,
): Promise<TaskAssignment> {
  const response = await httpClient.post<TaskAssignment>(`/tasks/${taskUuid}/assignments`, payload);

  return response.data;
}

export async function updateTaskAssignment(
  assignmentUuid: string,
  assignedHours: number,
): Promise<TaskAssignment> {
  const response = await httpClient.patch<TaskAssignment>(`/task-assignments/${assignmentUuid}`, {
    assignedHours,
  });

  return response.data;
}

export async function deleteTaskAssignment(assignmentUuid: string): Promise<void> {
  await httpClient.delete(`/task-assignments/${assignmentUuid}`);
}

export async function setTaskMainResponsible(
  taskUuid: string,
  userUuid: string,
): Promise<TaskAssignment> {
  const response = await httpClient.patch<TaskAssignment>(`/tasks/${taskUuid}/main-responsible`, {
    userUuid,
  });

  return response.data;
}
