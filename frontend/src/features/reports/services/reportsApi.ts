import axios from 'axios';

import { httpClient } from '../../../services/http/httpClient';
import {
  DashboardReport,
  GanttReport,
  ProjectBudgetReport,
  ResourceUtilizationReport,
  ProjectStatusReport,
  TrafficLightReport,
} from '../types';
import { WorkloadItem } from '../../team/types';

export interface ProjectExportDownload {
  blob: Blob;
  fileName: string;
}

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

export async function getProjectResourceUtilizationReport(
  projectUuid: string,
): Promise<ResourceUtilizationReport> {
  const response = await httpClient.get<ResourceUtilizationReport>(
    `/projects/${projectUuid}/reports/resource-utilization`,
  );

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

export async function downloadProjectPdfExport(projectUuid: string): Promise<ProjectExportDownload> {
  return downloadProjectExport(projectUuid, 'pdf', 'reporte-proyecto.pdf');
}

export async function downloadProjectExcelExport(projectUuid: string): Promise<ProjectExportDownload> {
  return downloadProjectExport(projectUuid, 'excel', 'reporte-proyecto.xlsx');
}

export function parseContentDispositionFileName(headerValue: string | undefined): string | null {
  if (headerValue === undefined) {
    return null;
  }

  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);

  if (encodedMatch?.[1] !== undefined) {
    return decodeURIComponent(encodedMatch[1]);
  }

  const quotedMatch = /filename="([^"]+)"/i.exec(headerValue);

  if (quotedMatch?.[1] !== undefined) {
    return quotedMatch[1];
  }

  const plainMatch = /filename=([^;]+)/i.exec(headerValue);

  return plainMatch?.[1]?.trim() ?? null;
}

async function downloadProjectExport(
  projectUuid: string,
  format: 'pdf' | 'excel',
  fallbackFileName: string,
): Promise<ProjectExportDownload> {
  const response = await httpClient
    .get<Blob>(`/projects/${projectUuid}/exports/${format}`, {
      responseType: 'blob',
    })
    .catch(async (error: unknown) => {
      throw await normalizeBlobDownloadError(error);
    });
  const headerValue = readHeader(response.headers, 'content-disposition');

  return {
    blob: response.data,
    fileName: parseContentDispositionFileName(headerValue) ?? fallbackFileName,
  };
}

function readHeader(headers: unknown, headerName: string): string | undefined {
  if (headers === null || typeof headers !== 'object') {
    return undefined;
  }

  if (hasHeaderGetter(headers)) {
    const headerValue = headers.get(headerName);

    if (typeof headerValue === 'string') {
      return headerValue;
    }
  }

  const record = headers as Record<string, unknown>;
  const directHeader = record[headerName];

  if (typeof directHeader === 'string') {
    return directHeader;
  }

  const capitalizedHeader = record['Content-Disposition'];

  return typeof capitalizedHeader === 'string' ? capitalizedHeader : undefined;
}

function hasHeaderGetter(headers: object): headers is { get: (headerName: string) => unknown } {
  return 'get' in headers && typeof headers.get === 'function';
}

async function normalizeBlobDownloadError(error: unknown): Promise<unknown> {
  if (!axios.isAxiosError(error) || !(error.response?.data instanceof Blob)) {
    return error;
  }

  const text = await error.response.data.text();

  try {
    const parsed = JSON.parse(text) as unknown;

    if (isApiErrorPayload(parsed)) {
      return new Error(Array.isArray(parsed.message) ? parsed.message.join(' ') : parsed.message);
    }
  } catch {
    return error;
  }

  return error;
}

function isApiErrorPayload(value: unknown): value is { message: string | string[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    (typeof value.message === 'string' ||
      (Array.isArray(value.message) && value.message.every((item) => typeof item === 'string')))
  );
}
