import { httpClient } from '../../../services/http/httpClient';
import { Task, TaskDependenciesResponse, TaskDependency, TaskPayload } from '../types';

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
