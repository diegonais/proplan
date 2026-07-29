export type ResourceCategory =
  | 'DESKTOP_COMPUTER'
  | 'LAPTOP'
  | 'SERVER'
  | 'MOBILE_DEVICE'
  | 'TABLET'
  | 'PERIPHERAL'
  | 'NETWORK_EQUIPMENT'
  | 'SOFTWARE_LICENSE'
  | 'CLOUD_SERVICE'
  | 'OTHER';

export type ResourceOperationalStatus = 'OPERATIONAL' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export type ResourceUnavailableReason =
  | 'RESOURCE_DELETED'
  | 'RESOURCE_INACTIVE'
  | 'NON_OPERATIONAL_STATUS'
  | 'ASSIGNMENT_CONFLICT';

export interface Resource {
  uuid: string;
  name: string;
  description: string | null;
  code: string;
  category: ResourceCategory;
  serialNumber: string | null;
  operationalStatus: ResourceOperationalStatus;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResourcePayload {
  name: string;
  code: string;
  description?: string | null;
  category: ResourceCategory;
  serialNumber?: string | null;
  operationalStatus?: ResourceOperationalStatus;
  notes?: string | null;
}

export interface ResourceStatusPayload {
  operationalStatus?: ResourceOperationalStatus;
  isActive?: boolean;
}

export interface ResourcesListParams {
  page: number;
  limit: number;
  search?: string;
  category?: ResourceCategory;
  operationalStatus?: ResourceOperationalStatus;
  isActive?: boolean;
  orderBy?: 'name' | 'code' | 'category' | 'operationalStatus' | 'isActive' | 'createdAt';
  order?: 'ASC' | 'DESC';
}

export interface PaginatedResourcesResponse {
  data: Resource[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ResourceAvailabilityConflict {
  uuid: string;
  projectUuid: string;
  taskUuid: string | null;
  startDate: string;
  endDate: string;
}

export interface ResourceAvailability {
  resourceUuid: string;
  available: boolean;
  operationalStatus: ResourceOperationalStatus;
  unavailableReason: ResourceUnavailableReason | null;
  conflicts: ResourceAvailabilityConflict[];
}

export type ResourceAssignmentTemporalStatus = 'PROGRAMADA' | 'ACTIVA' | 'FINALIZADA';

export interface ResourceAssignmentUser {
  uuid: string;
  name: string;
  email: string;
}

export interface ResourceAssignmentTask {
  uuid: string;
  name: string;
}

export interface ResourceAssignmentProject {
  uuid: string;
  name: string;
}

export interface ResourceAssignmentResource {
  uuid: string;
  name: string;
  code: string;
  category: ResourceCategory;
  operationalStatus: ResourceOperationalStatus;
}

export interface ResourceAssignment {
  uuid: string;
  resourceUuid: string;
  projectUuid: string;
  taskUuid: string | null;
  startDate: string;
  endDate: string;
  temporalStatus: ResourceAssignmentTemporalStatus;
  assignedByUuid: string;
  notes: string | null;
  resource: ResourceAssignmentResource;
  project: ResourceAssignmentProject;
  task: ResourceAssignmentTask | null;
  assignedBy: ResourceAssignmentUser;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceAssignmentPayload {
  resourceUuid: string;
  startDate: string;
  endDate: string;
  taskUuid?: string | null;
  notes?: string | null;
}

export interface ResourceAssignmentsListParams {
  resourceUuid?: string;
  category?: ResourceCategory;
  taskUuid?: string;
  temporalStatus?: ResourceAssignmentTemporalStatus;
  startDate?: string;
  endDate?: string;
}

export interface AvailableResourcesParams {
  startDate: string;
  endDate: string;
  taskUuid?: string;
}

export const resourceCategories: readonly ResourceCategory[] = [
  'DESKTOP_COMPUTER',
  'LAPTOP',
  'SERVER',
  'MOBILE_DEVICE',
  'TABLET',
  'PERIPHERAL',
  'NETWORK_EQUIPMENT',
  'SOFTWARE_LICENSE',
  'CLOUD_SERVICE',
  'OTHER',
];

export const resourceOperationalStatuses: readonly ResourceOperationalStatus[] = [
  'OPERATIONAL',
  'MAINTENANCE',
  'OUT_OF_SERVICE',
];

export function getResourceCategoryLabel(category: ResourceCategory): string {
  const labels: Record<ResourceCategory, string> = {
    DESKTOP_COMPUTER: 'Computadora de escritorio',
    LAPTOP: 'Laptop',
    SERVER: 'Servidor',
    MOBILE_DEVICE: 'Dispositivo movil',
    TABLET: 'Tablet',
    PERIPHERAL: 'Periferico',
    NETWORK_EQUIPMENT: 'Equipo de red',
    SOFTWARE_LICENSE: 'Licencia de software',
    CLOUD_SERVICE: 'Servicio en la nube',
    OTHER: 'Otro',
  };

  return labels[category];
}

export function getResourceOperationalStatusLabel(status: ResourceOperationalStatus): string {
  const labels: Record<ResourceOperationalStatus, string> = {
    OPERATIONAL: 'Operativo',
    MAINTENANCE: 'En mantenimiento',
    OUT_OF_SERVICE: 'Fuera de servicio',
  };

  return labels[status];
}

export function getResourceUnavailableReasonLabel(reason: ResourceUnavailableReason): string {
  const labels: Record<ResourceUnavailableReason, string> = {
    RESOURCE_DELETED: 'El recurso fue eliminado logicamente.',
    RESOURCE_INACTIVE: 'El recurso esta inactivo.',
    NON_OPERATIONAL_STATUS: 'El recurso no esta en estado operativo.',
    ASSIGNMENT_CONFLICT: 'Existe una asignacion que se superpone con el intervalo consultado.',
  };

  return labels[reason];
}

export function getResourceAssignmentTemporalStatusLabel(
  status: ResourceAssignmentTemporalStatus,
): string {
  const labels: Record<ResourceAssignmentTemporalStatus, string> = {
    PROGRAMADA: 'Programada',
    ACTIVA: 'Activa',
    FINALIZADA: 'Finalizada',
  };

  return labels[status];
}
