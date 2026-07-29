import { httpClient } from '../../../services/http/httpClient';
import {
  PaginatedResourcesResponse,
  Resource,
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

function removeEmptyParams(params: ResourcesListParams): ResourcesListParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as ResourcesListParams;
}
