import { httpClient } from '../../../services/http/httpClient';
import { UserRole } from '../../auth/types';
import {
  ManagerOption,
  PaginatedProjectsResponse,
  Project,
  ProjectPayload,
  ProjectsListParams,
} from '../types';

interface PaginatedUsersResponse {
  data: ManagerOption[];
}

export async function listProjects(params: ProjectsListParams): Promise<PaginatedProjectsResponse> {
  const response = await httpClient.get<PaginatedProjectsResponse>('/projects', {
    params: removeEmptyParams(params),
  });

  return response.data;
}

export async function getProject(uuid: string): Promise<Project> {
  const response = await httpClient.get<Project>(`/projects/${uuid}`);

  return response.data;
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  const response = await httpClient.post<Project>('/projects', payload);

  return response.data;
}

export async function updateProject(uuid: string, payload: ProjectPayload): Promise<Project> {
  const response = await httpClient.patch<Project>(`/projects/${uuid}`, payload);

  return response.data;
}

export async function deleteProject(uuid: string): Promise<void> {
  await httpClient.delete(`/projects/${uuid}`);
}

export async function listActiveProjectManagers(): Promise<ManagerOption[]> {
  const roles: UserRole[] = ['PROJECT_MANAGER', 'ADMIN'];
  const responses = await Promise.all(
    roles.map((role) =>
      httpClient.get<PaginatedUsersResponse>('/users', {
        params: {
          page: 1,
          limit: 100,
          role,
          isActive: true,
          orderBy: 'name',
          order: 'ASC',
        },
      }),
    ),
  );

  return responses
    .flatMap((response) => response.data.data)
    .sort((firstManager, secondManager) => firstManager.name.localeCompare(secondManager.name));
}

function removeEmptyParams(params: ProjectsListParams): ProjectsListParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as ProjectsListParams;
}
