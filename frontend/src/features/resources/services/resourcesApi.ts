import { httpClient } from '../../../services/http/httpClient';
import {
  PaginatedResourcesResponse,
  AvailableResourcesParams,
  Resource,
  ResourceAssignment,
  ResourceAssignmentPayload,
  ResourceAssignmentsListParams,
  ResourceAvailability,
  ResourcePayload,
  ResourceStatusPayload,
  ResourcesListParams,
} from '../types';

export async function listResources(
  params: ResourcesListParams,
): Promise<PaginatedResourcesResponse> {
  const response = await httpClient.get<PaginatedResourcesResponse>('/resources', {
    params: removeEmptyParams(params),
  });

  return response.data;
}

export async function createResource(payload: ResourcePayload): Promise<Resource> {
  const response = await httpClient.post<Resource>('/resources', payload);

  return response.data;
}

export async function updateResource(uuid: string, payload: ResourcePayload): Promise<Resource> {
  const response = await httpClient.patch<Resource>(`/resources/${uuid}`, payload);

  return response.data;
}

export async function updateResourceStatus(
  uuid: string,
  payload: ResourceStatusPayload,
): Promise<Resource> {
  const response = await httpClient.patch<Resource>(`/resources/${uuid}/status`, payload);

  return response.data;
}

export async function deleteResource(uuid: string): Promise<void> {
  await httpClient.delete(`/resources/${uuid}`);
}

export async function checkResourceAvailability(
  uuid: string,
  startDate: string,
  endDate: string,
): Promise<ResourceAvailability> {
  const response = await httpClient.get<ResourceAvailability>(`/resources/${uuid}/availability`, {
    params: { startDate, endDate },
  });

  return response.data;
}

export async function listProjectResourceAssignments(
  projectUuid: string,
  params: ResourceAssignmentsListParams = {},
): Promise<ResourceAssignment[]> {
  const response = await httpClient.get<ResourceAssignment[]>(
    `/projects/${projectUuid}/resource-assignments`,
    {
      params: removeEmptyParams(params),
    },
  );

  return response.data;
}

export async function listAvailableProjectResources(
  projectUuid: string,
  params: AvailableResourcesParams,
): Promise<Resource[]> {
  const response = await httpClient.get<Resource[]>(`/projects/${projectUuid}/available-resources`, {
    params: removeEmptyParams(params),
  });

  return response.data;
}

export async function createResourceAssignment(
  projectUuid: string,
  payload: ResourceAssignmentPayload,
): Promise<ResourceAssignment> {
  const response = await httpClient.post<ResourceAssignment>(
    `/projects/${projectUuid}/resource-assignments`,
    payload,
  );

  return response.data;
}

export async function updateResourceAssignment(
  uuid: string,
  payload: ResourceAssignmentPayload,
): Promise<ResourceAssignment> {
  const response = await httpClient.patch<ResourceAssignment>(`/resource-assignments/${uuid}`, payload);

  return response.data;
}

export async function deleteResourceAssignment(uuid: string): Promise<void> {
  await httpClient.delete(`/resource-assignments/${uuid}`);
}

function removeEmptyParams<TParams extends object>(params: TParams): Partial<TParams> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<TParams>;
}
