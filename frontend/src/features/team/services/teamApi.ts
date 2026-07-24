import { httpClient } from '../../../services/http/httpClient';
import { ProjectMember, ProjectMemberCandidate, WorkloadItem } from '../types';

export async function listProjectMembers(projectUuid: string): Promise<ProjectMember[]> {
  const response = await httpClient.get<ProjectMember[]>(`/projects/${projectUuid}/members`);

  return response.data;
}

export async function listProjectMemberCandidates(projectUuid: string): Promise<ProjectMemberCandidate[]> {
  const response = await httpClient.get<ProjectMemberCandidate[]>(
    `/projects/${projectUuid}/member-candidates`,
  );

  return response.data;
}

export async function addProjectMember(projectUuid: string, userUuid: string): Promise<ProjectMember> {
  const response = await httpClient.post<ProjectMember>(`/projects/${projectUuid}/members`, {
    userUuid,
  });

  return response.data;
}

export async function removeProjectMember(projectUuid: string, userUuid: string): Promise<void> {
  await httpClient.delete(`/projects/${projectUuid}/members/${userUuid}`);
}

export async function getProjectWorkload(projectUuid: string): Promise<WorkloadItem[]> {
  const response = await httpClient.get<WorkloadItem[]>(`/projects/${projectUuid}/workload`);

  return response.data;
}
