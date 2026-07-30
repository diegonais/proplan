import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import * as PDFKit from 'pdfkit';
import { In, Repository } from 'typeorm';

import { TaskDependencyType } from '../../common/enums/task-dependency-type.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { addMoney, calculatePercentage, subtractMoney } from '../../common/utils/decimal-money';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { calculateTemporalStatus } from '../resource-assignments/dto/resource-assignment-response.dto';
import { ResourceAssignmentTemporalStatus } from '../resource-assignments/dto/resource-assignment-temporal-status.enum';
import { ResourceAssignment } from '../resource-assignments/entities/resource-assignment.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../task-dependencies/entities/task-dependency.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import {
  calculateTrafficLight,
  getTodayInLaPaz,
  PROPLAN_TIME_ZONE,
  TrafficLightCalculation,
} from './reports-calculations';
import { ResourcesReportQueryDto } from './dto/resources-report-query.dto';
import {
  ResourcesReportItemResponseDto,
  ResourcesReportResponseDto,
} from './dto/resources-report-response.dto';
import { ReportsService } from './reports.service';

export interface GeneratedExportFile {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

export enum ProjectExportReportType {
  FULL = 'full',
  GANTT = 'gantt',
  BUDGET = 'budget',
  STATUS = 'status',
  RESOURCES = 'resources',
  WORKLOAD = 'workload',
}

interface ExportUser {
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
}

interface ExportTask {
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
  plannedBudget: string;
  actualCost: string;
}

interface ExportAssignment {
  uuid: string;
  taskUuid: string;
  userUuid: string;
  assignedHours: string;
  isMainResponsible: boolean;
  user: ExportUser;
}

interface ExportMember {
  uuid: string;
  projectUuid: string;
  userUuid: string;
  joinedAt: Date;
  user: ExportUser;
}

interface ExportDependency {
  uuid: string;
  predecessorTaskUuid: string;
  successorTaskUuid: string;
  dependencyType: TaskDependencyType;
}

interface ExportResource {
  uuid: string;
  code: string;
  name: string;
  category: string;
  operationalStatus: string;
  description: string | null;
  serialNumber: string | null;
  isActive: boolean;
}

interface ExportResourceAssignment {
  uuid: string;
  resourceUuid: string;
  projectUuid: string;
  taskUuid: string | null;
  resource: ExportResource;
  projectName: string;
  taskName: string | null;
  startDate: string;
  endDate: string;
  temporalStatus: ResourceAssignmentTemporalStatus;
}

interface ExportGanttTask {
  task: ExportTask;
  level: number;
}

interface ExportFinancialSummary {
  approvedBudget: string;
  distributedBudget: string;
  totalActualCost: string;
  balance: string;
  consumedPercentage: string | null;
}

interface ExportProjectData {
  project: Project;
  manager: ExportUser;
  tasks: ExportTask[];
  members: ExportMember[];
  assignments: ExportAssignment[];
  dependencies: ExportDependency[];
  resources: ExportResource[];
  resourceAssignments: ExportResourceAssignment[];
  trafficLight: TrafficLightCalculation;
  progressPercentage: string;
  financialSummary: ExportFinancialSummary;
  generatedAt: Date;
  generatedAtLabel: string;
}

const PDF_CONTENT_TYPE = 'application/pdf';
const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_BLUE = '#1E3A5F';
const PDF_LIGHT_BLUE = '#EAF1F8';
const PDF_BORDER = '#D6DEE8';
const PDF_TEXT_MUTED = '#5B6673';
const PdfDocument = PDFKit as unknown as new (
  options?: PDFKit.PDFDocumentOptions,
) => PDFKit.PDFDocument;

@Injectable()
export class ExportsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(TaskDependency)
    private readonly taskDependenciesRepository: Repository<TaskDependency>,
    @InjectRepository(TaskAssignment)
    private readonly taskAssignmentsRepository: Repository<TaskAssignment>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    @InjectRepository(ResourceAssignment)
    private readonly resourceAssignmentsRepository: Repository<ResourceAssignment>,
    private readonly reportsService: ReportsService,
  ) {}

  async generateProjectPdf(
    projectUuid: string,
    currentUser: AuthenticatedUser,
    reportType = ProjectExportReportType.FULL,
  ): Promise<GeneratedExportFile> {
    const data = await this.getExportData(projectUuid, currentUser);
    const buffer = await buildPdf(data, reportType);

    return {
      buffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: buildExportFileName(
        data.project.name,
        data.project.uuid,
        data.generatedAt,
        'pdf',
        reportType,
      ),
    };
  }

  async generateProjectExcel(
    projectUuid: string,
    currentUser: AuthenticatedUser,
    reportType = ProjectExportReportType.FULL,
  ): Promise<GeneratedExportFile> {
    const data = await this.getExportData(projectUuid, currentUser);
    const buffer = await buildExcel(data, reportType);

    return {
      buffer,
      contentType: EXCEL_CONTENT_TYPE,
      fileName: buildExportFileName(
        data.project.name,
        data.project.uuid,
        data.generatedAt,
        'xlsx',
        reportType,
      ),
    };
  }

  async generateResourcesReportPdf(
    query: ResourcesReportQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<GeneratedExportFile> {
    const generatedAt = new Date();
    const data = await this.reportsService.getResourcesReport(query, currentUser);
    const buffer = await buildResourcesReportPdf(data, generatedAt);

    return {
      buffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: buildResourcesExportFileName(generatedAt, 'pdf'),
    };
  }

  async generateResourcesReportExcel(
    query: ResourcesReportQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<GeneratedExportFile> {
    const generatedAt = new Date();
    const data = await this.reportsService.getResourcesReport(query, currentUser);
    const buffer = await buildResourcesReportExcel(data, generatedAt);

    return {
      buffer,
      contentType: EXCEL_CONTENT_TYPE,
      fileName: buildResourcesExportFileName(generatedAt, 'xlsx'),
    };
  }

  private async getExportData(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<ExportProjectData> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    this.ensureCanExportProject(project, currentUser);

    const tasks = await this.tasksRepository.find({
      where: { projectUuid: project.uuid },
      order: { startDate: 'ASC', endDate: 'ASC', name: 'ASC', uuid: 'ASC' },
    });
    const taskUuids = tasks.map((task) => task.uuid);
    const generatedAt = new Date();
    const today = getTodayInLaPaz(generatedAt);
    const [members, assignments, dependencies, resourceAssignments] = await Promise.all([
      this.findProjectMembers(project.uuid),
      this.findTaskAssignments(taskUuids),
      this.findTaskDependencies(taskUuids),
      this.findResourceAssignments(project.uuid, today),
    ]);
    const activeFinancialTasks = tasks.filter((task) => task.status !== TaskStatus.CANCELLED);

    return {
      project,
      manager: mapSafeUser(project.manager),
      tasks: tasks.map(mapTask),
      members,
      assignments,
      dependencies,
      resources: uniqueResources(resourceAssignments),
      resourceAssignments,
      trafficLight: calculateTrafficLight(project, tasks, today),
      progressPercentage: calculateAverageProgress(activeFinancialTasks),
      financialSummary: buildFinancialSummary(project, activeFinancialTasks),
      generatedAt,
      generatedAtLabel: formatDateTimeInLaPaz(generatedAt),
    };
  }

  private async findActiveProjectOrFail(projectUuid: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { uuid: projectUuid },
      relations: { manager: true },
    });

    if (project === null) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private ensureCanExportProject(project: Project, currentUser: AuthenticatedUser): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para exportar reportes completos del proyecto.');
  }

  private async findProjectMembers(projectUuid: string): Promise<ExportMember[]> {
    const members = await this.projectMembersRepository.find({
      where: { projectUuid },
      relations: { user: true },
      order: { joinedAt: 'ASC', uuid: 'ASC' },
    });

    return members.map((member) => ({
      uuid: member.uuid,
      projectUuid: member.projectUuid,
      userUuid: member.userUuid,
      joinedAt: member.joinedAt,
      user: mapSafeUser(member.user),
    }));
  }

  private async findTaskAssignments(taskUuids: readonly string[]): Promise<ExportAssignment[]> {
    if (taskUuids.length === 0) {
      return [];
    }

    const assignments = await this.taskAssignmentsRepository.find({
      where: { taskUuid: In([...taskUuids]) },
      relations: { user: true },
      order: { taskUuid: 'ASC', isMainResponsible: 'DESC', uuid: 'ASC' },
    });

    return assignments.map((assignment) => ({
      uuid: assignment.uuid,
      taskUuid: assignment.taskUuid,
      userUuid: assignment.userUuid,
      assignedHours: assignment.assignedHours,
      isMainResponsible: assignment.isMainResponsible,
      user: mapSafeUser(assignment.user),
    }));
  }

  private async findTaskDependencies(taskUuids: readonly string[]): Promise<ExportDependency[]> {
    if (taskUuids.length === 0) {
      return [];
    }

    const dependencies = await this.taskDependenciesRepository.find({
      where: {
        predecessorTaskUuid: In([...taskUuids]),
        successorTaskUuid: In([...taskUuids]),
      },
      order: { uuid: 'ASC' },
    });

    return dependencies.map((dependency) => ({
      uuid: dependency.uuid,
      predecessorTaskUuid: dependency.predecessorTaskUuid,
      successorTaskUuid: dependency.successorTaskUuid,
      dependencyType: dependency.dependencyType,
    }));
  }

  private async findResourceAssignments(
    projectUuid: string,
    today: string,
  ): Promise<ExportResourceAssignment[]> {
    const assignments = await this.resourceAssignmentsRepository.find({
      where: { projectUuid },
      relations: { resource: true, project: true, task: true },
      order: { startDate: 'ASC', endDate: 'ASC', uuid: 'ASC' },
    });

    return assignments.map((assignment) => ({
      uuid: assignment.uuid,
      resourceUuid: assignment.resourceUuid,
      projectUuid: assignment.projectUuid,
      taskUuid: assignment.taskUuid,
      resource: mapResource(assignment),
      projectName: assignment.project.name,
      taskName: assignment.task?.name ?? null,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      temporalStatus: calculateTemporalStatus(assignment.startDate, assignment.endDate, today),
    }));
  }
}

async function buildPdf(
  data: ExportProjectData,
  reportType: ProjectExportReportType,
): Promise<Buffer> {
  const document = new PdfDocument({
    size: 'A4',
    margin: 42,
    compress: false,
    info: {
      Title: `Reporte PROPLAN - ${data.project.name}`,
      Author: 'PROPLAN',
      Subject: 'Exportacion de proyecto',
    },
  });
  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    document.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    document.on('error', (error) => {
      reject(error instanceof Error ? error : new Error('No se pudo generar el PDF.'));
    });
  });

  addPdfHeader(document, data, reportType);

  if (reportType === ProjectExportReportType.STATUS) {
    addPdfProjectSummary(document, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.STATUS)) {
    addPdfStatusReport(document, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.GANTT)) {
    addPdfGanttReport(document, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.WORKLOAD)) {
    addPdfWorkloadReport(document, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.RESOURCES)) {
    addPdfResourcesReport(document, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.BUDGET)) {
    addPdfBudgetReport(document, data);
  }

  document.end();

  return bufferPromise;
}

async function buildExcel(
  data: ExportProjectData,
  reportType: ProjectExportReportType,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROPLAN';
  workbook.created = data.generatedAt;
  workbook.modified = data.generatedAt;

  addProjectSheet(workbook, data);

  if (shouldIncludeReport(reportType, ProjectExportReportType.STATUS)) {
    addStatusSheet(workbook, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.GANTT)) {
    addTasksSheet(workbook, data);
    addGanttSheet(workbook, data);
    addDependenciesSheet(workbook, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.WORKLOAD)) {
    addTeamSheet(workbook, data);
    addAssignmentsSheet(workbook, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.BUDGET)) {
    addBudgetSheet(workbook, data);
  }

  if (shouldIncludeReport(reportType, ProjectExportReportType.RESOURCES)) {
    addResourcesSheet(workbook, data);
    addResourceAssignmentsSheet(workbook, data);
  }

  const workbookBuffer = await workbook.xlsx.writeBuffer();

  return Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer);
}

async function buildResourcesReportPdf(
  data: ResourcesReportResponseDto,
  generatedAt: Date,
): Promise<Buffer> {
  const document = new PdfDocument({
    size: 'A4',
    margin: 42,
    compress: false,
    info: {
      Title: 'Reporte PROPLAN - Recursos',
      Author: 'PROPLAN',
      Subject: 'Exportacion de recursos',
    },
  });
  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    document.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    document.on('error', (error) => {
      reject(error instanceof Error ? error : new Error('No se pudo generar el PDF.'));
    });
  });

  addGenericPdfHeader(
    document,
    'Carga y utilizacion de recursos',
    `Generado: ${formatDateTimeInLaPaz(generatedAt)}`,
  );
  addPdfMetricCards(document, [
    ['Recursos humanos', data.summary.totalHumanResources.toString()],
    ['Recursos materiales', data.summary.totalMaterialResources.toString()],
    ['Horas humanas', data.summary.totalAssignedHours],
    ['Dias materiales', data.summary.totalMaterialAssignmentDays.toString()],
  ]);
  addPdfSection(document, 'Filtros aplicados', [
    ['Proyecto UUID', data.filters.projectUuid ?? 'Todos los proyectos autorizados'],
    ['Tipo de recurso', data.filters.resourceType],
    ['Mes', data.filters.month ?? 'No aplica'],
    ['Fecha inicial', data.filters.startDate ?? 'No aplica'],
    ['Fecha final', data.filters.endDate ?? 'No aplica'],
    ['Politica de fechas', data.datePolicy],
  ]);
  addPdfTable(
    document,
    'Detalle de recursos',
    ['Tipo', 'Proyecto', 'Recurso', 'Detalle', 'Horas', 'Dias', 'Periodo', 'Estado'],
    data.items.map(mapResourcesReportItemToPdfRow),
  );

  document.end();

  return bufferPromise;
}

async function buildResourcesReportExcel(
  data: ResourcesReportResponseDto,
  generatedAt: Date,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROPLAN';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const summaryWorksheet = workbook.addWorksheet('Resumen');
  summaryWorksheet.properties.tabColor = { argb: 'FF1E3A5F' };
  summaryWorksheet.columns = [
    { header: 'Campo', key: 'field', width: 32 },
    { header: 'Valor', key: 'value', width: 64 },
  ];
  addRows(summaryWorksheet, [
    { field: 'Generado en America/La_Paz', value: formatDateTimeInLaPaz(generatedAt) },
    { field: 'Proyecto UUID', value: data.filters.projectUuid ?? 'Todos los proyectos autorizados' },
    { field: 'Tipo de recurso', value: data.filters.resourceType },
    { field: 'Mes', value: data.filters.month ?? '' },
    { field: 'Fecha inicial', value: data.filters.startDate ?? '' },
    { field: 'Fecha final', value: data.filters.endDate ?? '' },
    { field: 'Recursos humanos', value: data.summary.totalHumanResources },
    { field: 'Recursos materiales', value: data.summary.totalMaterialResources },
    { field: 'Horas humanas', value: Number(data.summary.totalAssignedHours) },
    { field: 'Dias materiales', value: data.summary.totalMaterialAssignmentDays },
    { field: 'Asignaciones materiales activas', value: data.summary.activeMaterialAssignments },
  ]);
  formatHeader(summaryWorksheet);

  const detailWorksheet = workbook.addWorksheet('Recursos');
  detailWorksheet.properties.tabColor = { argb: 'FF8064A2' };
  detailWorksheet.columns = [
    { header: 'Tipo', key: 'itemType', width: 14 },
    { header: 'Proyecto', key: 'projectName', width: 34 },
    { header: 'Recurso', key: 'resourceName', width: 32 },
    { header: 'Codigo', key: 'resourceCode', width: 18 },
    { header: 'Categoria', key: 'resourceCategory', width: 24 },
    { header: 'Estado operativo', key: 'operationalStatus', width: 22 },
    { header: 'Horas asignadas', key: 'assignedHours', width: 18 },
    { header: 'Dias asignados', key: 'assignedDays', width: 16 },
    { header: 'Actividad', key: 'taskName', width: 34 },
    { header: 'Fecha inicial', key: 'startDate', width: 16 },
    { header: 'Fecha final', key: 'endDate', width: 16 },
    { header: 'Estado temporal', key: 'temporalStatus', width: 18 },
    { header: 'Disponibilidad actual', key: 'currentAvailability', width: 22 },
    { header: 'Observaciones', key: 'authorizedNotes', width: 42 },
  ];
  addRows(detailWorksheet, data.items.map(mapResourcesReportItemToExcelRow));
  formatHeader(detailWorksheet);

  const workbookBuffer = await workbook.xlsx.writeBuffer();

  return Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer);
}

function addProjectSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Proyecto');
  worksheet.properties.tabColor = { argb: 'FF1E3A5F' };
  worksheet.columns = [
    { header: 'Campo', key: 'field', width: 28 },
    { header: 'Valor', key: 'value', width: 70 },
  ];
  addRows(worksheet, [
    { field: 'UUID', value: data.project.uuid },
    { field: 'Nombre', value: data.project.name },
    { field: 'Objetivo', value: data.project.objective },
    { field: 'Descripcion', value: data.project.description ?? 'Sin descripcion' },
    { field: 'Jefe', value: `${data.manager.name} (${data.manager.email})` },
    { field: 'Fecha inicio', value: data.project.startDate },
    { field: 'Fecha fin', value: data.project.endDate },
    { field: 'Estado', value: data.project.status },
    { field: 'Semaforo', value: data.trafficLight.color },
    { field: 'Razones semaforo', value: data.trafficLight.reasons.join('; ') },
    { field: 'Progreso', value: `${data.progressPercentage}%` },
    { field: 'Generado en America/La_Paz', value: data.generatedAtLabel },
  ]);
  formatHeader(worksheet);
}

function addStatusSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Estado general');
  worksheet.properties.tabColor = { argb: resolveTrafficLightTabColor(data.trafficLight.color) };
  worksheet.columns = [
    { header: 'Indicador', key: 'indicator', width: 34 },
    { header: 'Valor', key: 'value', width: 54 },
  ];
  addRows(worksheet, [
    { indicator: 'Semaforo', value: data.trafficLight.color },
    { indicator: 'Progreso promedio', value: `${data.progressPercentage}%` },
    { indicator: 'Actividades activas no canceladas', value: data.trafficLight.activeNonCancelledTasksCount },
    { indicator: 'Actividades vencidas', value: data.trafficLight.overdueTasksCount },
    { indicator: 'Porcentaje de actividades vencidas', value: `${data.trafficLight.overdueTasksPercentage}%` },
    { indicator: 'Proyecto vencido', value: data.trafficLight.isProjectOverdue ? 'Si' : 'No' },
    { indicator: 'Presupuesto aprobado', value: Number(data.trafficLight.approvedBudget) },
    { indicator: 'Costo ejecutado', value: Number(data.trafficLight.totalActualCost) },
    { indicator: 'Consumo presupuestario', value: `${data.trafficLight.consumedPercentage}%` },
    { indicator: 'Razones', value: data.trafficLight.reasons.join('; ') },
  ]);
  formatHeader(worksheet);
}

function addTasksSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Actividades');
  worksheet.properties.tabColor = { argb: 'FF4472C4' };
  worksheet.columns = [
    { header: 'UUID', key: 'uuid', width: 38 },
    { header: 'Actividad', key: 'name', width: 36 },
    { header: 'Subactividad de', key: 'parentTask', width: 36 },
    { header: 'Descripcion', key: 'description', width: 48 },
    { header: 'Fecha inicio', key: 'startDate', width: 14 },
    { header: 'Fecha fin', key: 'endDate', width: 14 },
    { header: 'Estado', key: 'status', width: 18 },
    { header: 'Progreso', key: 'progress', width: 12 },
    { header: 'Horas estimadas', key: 'estimatedHours', width: 18 },
    { header: 'Responsable principal', key: 'mainResponsible', width: 32 },
  ];
  addRows(
    worksheet,
    data.tasks.map((task) => ({
      uuid: task.uuid,
      name: task.name,
      parentTask: task.parentTaskUuid === null ? '' : getTaskName(task.parentTaskUuid, data.tasks),
      description: task.description ?? '',
      startDate: task.startDate,
      endDate: task.endDate,
      status: task.status,
      progress: task.progress,
      estimatedHours: Number(task.estimatedHours),
      mainResponsible: getMainResponsibleName(task.uuid, data.assignments),
    })),
  );
  formatHeader(worksheet);
}

function addGanttSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Gantt');
  worksheet.properties.tabColor = { argb: 'FF4F81BD' };
  const timeBuckets = buildGanttTimeBuckets(data.project.startDate, data.project.endDate);
  const baseColumns: Partial<ExcelJS.Column>[] = [
    { header: 'Nivel', key: 'level', width: 8 },
    { header: 'Actividad', key: 'task', width: 38 },
    { header: 'Fecha inicio', key: 'startDate', width: 14 },
    { header: 'Fecha fin', key: 'endDate', width: 14 },
    { header: 'Duracion dias', key: 'durationDays', width: 15 },
    { header: 'Progreso', key: 'progress', width: 12 },
    { header: 'Estado', key: 'status', width: 18 },
    { header: 'Responsables', key: 'responsibles', width: 36 },
    { header: 'Predecesoras', key: 'predecessors', width: 36 },
    { header: 'Sucesoras', key: 'successors', width: 36 },
  ];

  worksheet.columns = [
    ...baseColumns,
    ...timeBuckets.map((bucket, index) => ({
      header: bucket.label,
      key: `bucket_${index.toString()}`,
      width: bucket.width,
    })),
  ];

  flattenExportGanttTasks(data.tasks).forEach((item) => {
    const rowValues: Record<string, unknown> = {
      level: item.level,
      task: `${'  '.repeat(item.level)}${item.task.name}`,
      startDate: item.task.startDate,
      endDate: item.task.endDate,
      durationDays: calculateInclusiveDateDays(item.task.startDate, item.task.endDate),
      progress: item.task.progress / 100,
      status: item.task.status,
      responsibles: getResponsibleNames(item.task.uuid, data.assignments),
      predecessors: getPredecessorNames(item.task.uuid, data.tasks, data.dependencies),
      successors: getSuccessorNames(item.task.uuid, data.tasks, data.dependencies),
    };

    timeBuckets.forEach((bucket, index) => {
      rowValues[`bucket_${index.toString()}`] = rangesOverlap(
        item.task.startDate,
        item.task.endDate,
        bucket.startDate,
        bucket.endDate,
      )
        ? 'X'
        : '';
    });

    const row = worksheet.addRow(sanitizeExcelRow(rowValues));
    const fillColor = item.level === 0 ? 'FF4F81BD' : 'FF9DC3E6';

    timeBuckets.forEach((bucket, index) => {
      if (!rangesOverlap(item.task.startDate, item.task.endDate, bucket.startDate, bucket.endDate)) {
        return;
      }

      const cell = row.getCell(baseColumns.length + index + 1);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor },
      };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  worksheet.getColumn('progress').numFmt = '0%';
  formatHeader(worksheet);
}

function addAssignmentsSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Asignaciones');
  worksheet.properties.tabColor = { argb: 'FF70AD47' };
  worksheet.columns = [
    { header: 'Actividad', key: 'task', width: 36 },
    { header: 'Usuario', key: 'user', width: 30 },
    { header: 'Correo', key: 'email', width: 36 },
    { header: 'Horas asignadas', key: 'assignedHours', width: 18 },
    { header: 'Responsable principal', key: 'isMainResponsible', width: 22 },
    { header: 'Actividad UUID', key: 'taskUuid', width: 38 },
    { header: 'Usuario UUID', key: 'userUuid', width: 38 },
  ];
  addRows(
    worksheet,
    data.assignments.map((assignment) => ({
      task: getTaskName(assignment.taskUuid, data.tasks),
      user: assignment.user.name,
      email: assignment.user.email,
      assignedHours: Number(assignment.assignedHours),
      isMainResponsible: assignment.isMainResponsible ? 'Si' : 'No',
      taskUuid: assignment.taskUuid,
      userUuid: assignment.userUuid,
    })),
  );
  formatHeader(worksheet);
}

function addTeamSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Equipo');
  worksheet.properties.tabColor = { argb: 'FF70AD47' };
  worksheet.columns = [
    { header: 'Usuario', key: 'user', width: 30 },
    { header: 'Correo', key: 'email', width: 36 },
    { header: 'Rol', key: 'role', width: 18 },
    { header: 'Fecha incorporacion', key: 'joinedAt', width: 24 },
    { header: 'Usuario UUID', key: 'userUuid', width: 38 },
  ];
  addRows(
    worksheet,
    data.members.map((member) => ({
      user: member.user.name,
      email: member.user.email,
      role: member.user.role,
      joinedAt: formatDateTimeInLaPaz(member.joinedAt),
      userUuid: member.userUuid,
    })),
  );
  formatHeader(worksheet);
}

function addBudgetSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Presupuesto y costos');
  worksheet.properties.tabColor = { argb: 'FFC55A11' };
  worksheet.columns = [
    { header: 'Tipo', key: 'type', width: 24 },
    { header: 'Actividad', key: 'task', width: 36 },
    { header: 'Presupuesto planificado', key: 'plannedBudget', width: 24 },
    { header: 'Costo ejecutado', key: 'actualCost', width: 18 },
    { header: 'Diferencia', key: 'variance', width: 18 },
    { header: 'Consumo', key: 'consumedPercentage', width: 14 },
    { header: 'Actividad UUID', key: 'taskUuid', width: 38 },
  ];
  addRows(worksheet, [
    {
      type: 'Proyecto',
      task: data.project.name,
      plannedBudget: Number(data.financialSummary.approvedBudget),
      actualCost: Number(data.financialSummary.totalActualCost),
      variance: Number(data.financialSummary.balance),
      consumedPercentage: Number(data.financialSummary.consumedPercentage ?? '0.00') / 100,
      taskUuid: '',
    },
    ...data.tasks
      .filter((task) => task.status !== TaskStatus.CANCELLED)
      .map((task) => ({
        type: 'Actividad',
        task: task.name,
        plannedBudget: Number(task.plannedBudget),
        actualCost: Number(task.actualCost),
        variance: Number(subtractMoney(task.plannedBudget, task.actualCost)),
        consumedPercentage:
          Number(calculatePercentage(task.actualCost, task.plannedBudget) ?? '0.00') / 100,
        taskUuid: task.uuid,
      })),
  ]);
  worksheet.getColumn('plannedBudget').numFmt = '#,##0.00';
  worksheet.getColumn('actualCost').numFmt = '#,##0.00';
  worksheet.getColumn('variance').numFmt = '#,##0.00';
  worksheet.getColumn('consumedPercentage').numFmt = '0.00%';
  formatHeader(worksheet);
}

function addDependenciesSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Dependencias');
  worksheet.properties.tabColor = { argb: 'FF5B9BD5' };
  worksheet.columns = [
    { header: 'Predecesora', key: 'predecessor', width: 36 },
    { header: 'Sucesora', key: 'successor', width: 36 },
    { header: 'Tipo', key: 'dependencyType', width: 20 },
    { header: 'Predecesora UUID', key: 'predecessorTaskUuid', width: 38 },
    { header: 'Sucesora UUID', key: 'successorTaskUuid', width: 38 },
  ];
  addRows(
    worksheet,
    data.dependencies.map((dependency) => ({
      predecessor: getTaskName(dependency.predecessorTaskUuid, data.tasks),
      successor: getTaskName(dependency.successorTaskUuid, data.tasks),
      dependencyType: dependency.dependencyType,
      predecessorTaskUuid: dependency.predecessorTaskUuid,
      successorTaskUuid: dependency.successorTaskUuid,
    })),
  );
  formatHeader(worksheet);
}

function addResourcesSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Recursos');
  worksheet.properties.tabColor = { argb: 'FF8064A2' };
  worksheet.columns = [
    { header: 'Codigo', key: 'code', width: 18 },
    { header: 'Nombre', key: 'name', width: 34 },
    { header: 'Categoria', key: 'category', width: 24 },
    { header: 'Estado operativo', key: 'operationalStatus', width: 22 },
    { header: 'Activo', key: 'isActive', width: 12 },
    { header: 'Serie', key: 'serialNumber', width: 24 },
    { header: 'Descripcion', key: 'description', width: 48 },
    { header: 'Recurso UUID', key: 'resourceUuid', width: 38 },
  ];
  addRows(
    worksheet,
    data.resources.map((resource) => ({
      code: resource.code,
      name: resource.name,
      category: resource.category,
      operationalStatus: resource.operationalStatus,
      isActive: resource.isActive ? 'Si' : 'No',
      serialNumber: resource.serialNumber ?? '',
      description: resource.description ?? '',
      resourceUuid: resource.uuid,
    })),
  );
  formatHeader(worksheet);
}

function addResourceAssignmentsSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Asignaciones de recursos');
  worksheet.properties.tabColor = { argb: 'FF8064A2' };
  worksheet.columns = [
    { header: 'Codigo', key: 'code', width: 18 },
    { header: 'Recurso', key: 'resource', width: 34 },
    { header: 'Categoria', key: 'category', width: 24 },
    { header: 'Estado operativo', key: 'operationalStatus', width: 22 },
    { header: 'Proyecto', key: 'project', width: 36 },
    { header: 'Actividad', key: 'task', width: 36 },
    { header: 'Fecha inicial', key: 'startDate', width: 16 },
    { header: 'Fecha final', key: 'endDate', width: 16 },
    { header: 'Estado temporal', key: 'temporalStatus', width: 18 },
    { header: 'Asignacion UUID', key: 'assignmentUuid', width: 38 },
    { header: 'Recurso UUID', key: 'resourceUuid', width: 38 },
    { header: 'Proyecto UUID', key: 'projectUuid', width: 38 },
    { header: 'Actividad UUID', key: 'taskUuid', width: 38 },
  ];
  addRows(
    worksheet,
    data.resourceAssignments.map((assignment) => ({
      code: assignment.resource.code,
      resource: assignment.resource.name,
      category: assignment.resource.category,
      operationalStatus: assignment.resource.operationalStatus,
      project: assignment.projectName,
      task: assignment.taskName ?? '',
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      temporalStatus: assignment.temporalStatus,
      assignmentUuid: assignment.uuid,
      resourceUuid: assignment.resourceUuid,
      projectUuid: assignment.projectUuid,
      taskUuid: assignment.taskUuid ?? '',
    })),
  );
  formatHeader(worksheet);
}

function addRows(worksheet: ExcelJS.Worksheet, rows: readonly Record<string, unknown>[]): void {
  rows.forEach((row) => {
    worksheet.addRow(sanitizeExcelRow(row));
  });
}

function sanitizeExcelRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'string' ? sanitizeExcelText(value) : value,
    ]),
  );
}

export function sanitizeExcelText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function buildExportFileName(
  projectName: string,
  projectUuid: string,
  generatedAt: Date,
  extension: 'pdf' | 'xlsx',
  reportType = ProjectExportReportType.FULL,
): string {
  const dateStamp = formatFileDateTime(generatedAt);
  const reportSegment =
    reportType === ProjectExportReportType.FULL ? 'completo' : reportType.replace(/[^a-z0-9]+/g, '-');
  const safeProjectName = projectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const projectSegment = safeProjectName.length > 0 ? safeProjectName : 'proyecto';

  return `proplan-${reportSegment}-${projectSegment}-${projectUuid.slice(0, 8)}-${dateStamp}.${extension}`;
}

function buildResourcesExportFileName(generatedAt: Date, extension: 'pdf' | 'xlsx'): string {
  return `proplan-recursos-${formatFileDateTime(generatedAt)}.${extension}`;
}

function mapResourcesReportItemToExcelRow(
  item: ResourcesReportItemResponseDto,
): Record<string, unknown> {
  return {
    itemType: item.itemType,
    projectName: item.projectName,
    resourceName: item.resourceName,
    resourceCode: item.resourceCode ?? '',
    resourceCategory: item.resourceCategory ?? '',
    operationalStatus: item.operationalStatus ?? '',
    assignedHours: item.assignedHours === null ? '' : Number(item.assignedHours),
    assignedDays: item.assignedDays ?? '',
    taskName: item.taskName ?? '',
    startDate: item.startDate ?? '',
    endDate: item.endDate ?? '',
    temporalStatus: item.temporalStatus ?? '',
    currentAvailability: item.currentAvailability ?? '',
    authorizedNotes: item.authorizedNotes ?? '',
  };
}

function mapResourcesReportItemToPdfRow(item: ResourcesReportItemResponseDto): string[] {
  return [
    item.itemType,
    item.projectName,
    item.resourceName,
    item.resourceCode ?? item.user?.email ?? 'Sin detalle',
    item.assignedHours ?? 'No aplica',
    item.assignedDays?.toString() ?? 'No aplica',
    item.startDate === null || item.endDate === null
      ? 'Periodo filtrado'
      : `${item.startDate} a ${item.endDate}`,
    item.temporalStatus ?? item.currentAvailability ?? 'Horas asignadas',
  ];
}

function formatHeader(worksheet: ExcelJS.Worksheet): void {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  headerRow.height = 24;
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };
  worksheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E2EF' } },
        left: { style: 'thin', color: { argb: 'FFD9E2EF' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E2EF' } },
        right: { style: 'thin', color: { argb: 'FFD9E2EF' } },
      };
    });

    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF7FAFC' },
      };
    }
  });
}

function shouldIncludeReport(
  selectedReportType: ProjectExportReportType,
  reportType: ProjectExportReportType,
): boolean {
  return selectedReportType === ProjectExportReportType.FULL || selectedReportType === reportType;
}

function getProjectExportReportTypeLabel(reportType: ProjectExportReportType): string {
  const labels: Record<ProjectExportReportType, string> = {
    [ProjectExportReportType.FULL]: 'Reporte completo',
    [ProjectExportReportType.GANTT]: 'Diagrama de Gantt',
    [ProjectExportReportType.BUDGET]: 'Presupuesto vs costos reales',
    [ProjectExportReportType.STATUS]: 'Estado general',
    [ProjectExportReportType.RESOURCES]: 'Utilizacion de recursos',
    [ProjectExportReportType.WORKLOAD]: 'Carga de trabajo',
  };

  return labels[reportType];
}

function resolveTrafficLightTabColor(color: TrafficLightCalculation['color']): string {
  const colors: Record<TrafficLightCalculation['color'], string> = {
    GREEN: 'FF70AD47',
    YELLOW: 'FFFFC000',
    RED: 'FFC00000',
  };

  return colors[color];
}

function addPdfHeader(
  document: PDFKit.PDFDocument,
  data: ExportProjectData,
  reportType: ProjectExportReportType,
): void {
  const contentWidth = getPdfContentWidth(document);
  const startX = document.page.margins.left;
  const startY = document.y;

  document.rect(startX, startY, contentWidth, 92).fill(PDF_BLUE);
  document
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('PROPLAN', startX + 18, startY + 16, { continued: false });
  document
    .fontSize(19)
    .text(getProjectExportReportTypeLabel(reportType), startX + 18, startY + 34, {
      width: contentWidth - 36,
    });
  document
    .font('Helvetica')
    .fontSize(9)
    .text(`Proyecto: ${data.project.name}`, startX + 18, startY + 63, {
      width: contentWidth - 36,
    });
  document.y = startY + 108;
  document.x = document.page.margins.left;
  document.fillColor('#111827');
}

function addGenericPdfHeader(
  document: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
): void {
  const contentWidth = getPdfContentWidth(document);
  const startX = document.page.margins.left;
  const startY = document.y;

  document.rect(startX, startY, contentWidth, 82).fill(PDF_BLUE);
  document
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('PROPLAN', startX + 18, startY + 16);
  document.fontSize(18).text(title, startX + 18, startY + 34, { width: contentWidth - 36 });
  document.font('Helvetica').fontSize(9).text(subtitle, startX + 18, startY + 59, {
    width: contentWidth - 36,
  });
  document.y = startY + 98;
  document.x = document.page.margins.left;
  document.fillColor('#111827');
}

function addPdfProjectSummary(document: PDFKit.PDFDocument, data: ExportProjectData): void {
  addPdfMetricCards(document, [
    ['Estado', data.project.status],
    ['Semaforo', data.trafficLight.color],
    ['Progreso', `${data.progressPercentage}%`],
    ['Generado', data.generatedAtLabel],
  ]);
  addPdfKeyValuePanel(document, 'Datos del proyecto', [
    ['Nombre', data.project.name],
    ['Objetivo', data.project.objective],
    ['Descripcion', data.project.description ?? 'Sin descripcion'],
    ['Jefe de proyecto', `${data.manager.name} (${data.manager.email})`],
    ['Periodo', `${data.project.startDate} a ${data.project.endDate}`],
  ]);
}

function addPdfStatusReport(document: PDFKit.PDFDocument, data: ExportProjectData): void {
  addPdfSectionTitle(document, 'Estado general');
  addPdfMetricCards(document, [
    ['Semaforo', data.trafficLight.color],
    ['Actividades vencidas', data.trafficLight.overdueTasksCount.toString()],
    ['Actividades activas', data.trafficLight.activeNonCancelledTasksCount.toString()],
    ['Consumo presupuesto', `${data.trafficLight.consumedPercentage}%`],
  ]);
  addPdfTable(
    document,
    'Razones del semaforo',
    ['Detalle'],
    data.trafficLight.reasons.map((reason) => [reason]),
  );
  addPdfTable(
    document,
    'Actividades vencidas',
    ['Actividad', 'Estado', 'Progreso', 'Fecha fin'],
    data.trafficLight.overdueTasks.map((task) => [
      task.name,
      task.status,
      `${task.progress.toString()}%`,
      task.endDate,
    ]),
  );
}

function addPdfGanttReport(document: PDFKit.PDFDocument, data: ExportProjectData): void {
  addPdfSectionTitle(document, 'Diagrama de Gantt');
  addPdfTable(
    document,
    'Cronograma',
    ['Nivel', 'Actividad', 'Inicio', 'Fin', 'Duracion', 'Progreso', 'Dependencias'],
    flattenExportGanttTasks(data.tasks).map((item) => [
      item.level.toString(),
      item.task.name,
      item.task.startDate,
      item.task.endDate,
      `${calculateInclusiveDateDays(item.task.startDate, item.task.endDate).toString()} dias`,
      `${item.task.progress.toString()}%`,
      buildDependencySummary(item.task.uuid, data.tasks, data.dependencies),
    ]),
  );
  addPdfTable(
    document,
    'Dependencias',
    ['Predecesora', 'Sucesora', 'Tipo'],
    data.dependencies.map((dependency) => [
      getTaskName(dependency.predecessorTaskUuid, data.tasks),
      getTaskName(dependency.successorTaskUuid, data.tasks),
      dependency.dependencyType,
    ]),
  );
}

function addPdfWorkloadReport(document: PDFKit.PDFDocument, data: ExportProjectData): void {
  addPdfSectionTitle(document, 'Carga de trabajo');
  addPdfTable(
    document,
    'Equipo',
    ['Nombre', 'Correo', 'Rol'],
    data.members.map((member) => [member.user.name, member.user.email, member.user.role]),
  );
  addPdfTable(
    document,
    'Asignaciones por actividad',
    ['Actividad', 'Usuario', 'Horas', 'Responsable'],
    data.assignments.map((assignment) => [
      getTaskName(assignment.taskUuid, data.tasks),
      assignment.user.name,
      assignment.assignedHours,
      assignment.isMainResponsible ? 'Si' : 'No',
    ]),
  );
}

function addPdfResourcesReport(document: PDFKit.PDFDocument, data: ExportProjectData): void {
  addPdfSectionTitle(document, 'Utilizacion de recursos');
  addPdfMetricCards(document, [
    ['Recursos asignados', data.resources.length.toString()],
    ['Asignaciones', data.resourceAssignments.length.toString()],
    [
      'Activas',
      data.resourceAssignments
        .filter((assignment) => assignment.temporalStatus === ResourceAssignmentTemporalStatus.ACTIVE)
        .length.toString(),
    ],
    [
      'Programadas',
      data.resourceAssignments
        .filter((assignment) => assignment.temporalStatus === ResourceAssignmentTemporalStatus.SCHEDULED)
        .length.toString(),
    ],
  ]);
  addPdfTable(
    document,
    'Recursos asignados',
    ['Codigo', 'Nombre', 'Categoria', 'Actividad', 'Periodo', 'Estado'],
    data.resourceAssignments.map((assignment) => [
      assignment.resource.code,
      assignment.resource.name,
      assignment.resource.category,
      assignment.taskName ?? 'Proyecto completo',
      `${assignment.startDate} a ${assignment.endDate}`,
      assignment.temporalStatus,
    ]),
  );
}

function addPdfBudgetReport(document: PDFKit.PDFDocument, data: ExportProjectData): void {
  addPdfSectionTitle(document, 'Presupuesto vs costos reales');
  addPdfMetricCards(document, [
    ['Aprobado', data.financialSummary.approvedBudget],
    ['Distribuido', data.financialSummary.distributedBudget],
    ['Ejecutado', data.financialSummary.totalActualCost],
    ['Saldo', data.financialSummary.balance],
  ]);
  addPdfTable(
    document,
    'Detalle por actividad',
    ['Actividad', 'Planificado', 'Ejecutado', 'Diferencia', 'Consumo'],
    data.tasks
      .filter((task) => task.status !== TaskStatus.CANCELLED)
      .map((task) => [
        task.name,
        task.plannedBudget,
        task.actualCost,
        subtractMoney(task.plannedBudget, task.actualCost),
        `${calculatePercentage(task.actualCost, task.plannedBudget) ?? '0.00'}%`,
      ]),
  );
}

function addPdfMetricCards(
  document: PDFKit.PDFDocument,
  metrics: readonly (readonly [string, string])[],
): void {
  ensurePdfSpace(document, 68);
  const gap = 8;
  const contentWidth = getPdfContentWidth(document);
  const cardWidth = (contentWidth - gap * 3) / 4;
  const startX = document.page.margins.left;
  const startY = document.y;

  metrics.slice(0, 4).forEach(([label, value], index) => {
    const cardX = startX + index * (cardWidth + gap);
    document.roundedRect(cardX, startY, cardWidth, 54, 4).fillAndStroke(PDF_LIGHT_BLUE, PDF_BORDER);
    document
      .fillColor(PDF_TEXT_MUTED)
      .font('Helvetica')
      .fontSize(7)
      .text(label.toUpperCase(), cardX + 8, startY + 9, { width: cardWidth - 16 });
    document
      .fillColor(PDF_BLUE)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(ellipsize(value, 28), cardX + 8, startY + 27, { width: cardWidth - 16 });
  });

  document.y = startY + 68;
  document.x = document.page.margins.left;
  document.fillColor('#111827').font('Helvetica');
}

function addPdfSectionTitle(document: PDFKit.PDFDocument, title: string): void {
  ensurePdfSpace(document, 42);
  document.x = document.page.margins.left;
  document.moveDown(0.2);
  document.font('Helvetica-Bold').fontSize(14).fillColor(PDF_BLUE).text(title);
  document
    .moveTo(document.page.margins.left, document.y + 3)
    .lineTo(document.page.width - document.page.margins.right, document.y + 3)
    .strokeColor(PDF_BORDER)
    .stroke();
  document.moveDown(0.7);
  document.x = document.page.margins.left;
  document.fillColor('#111827').font('Helvetica');
}

function addPdfKeyValuePanel(
  document: PDFKit.PDFDocument,
  title: string,
  rows: readonly (readonly [string, string])[],
): void {
  ensurePdfSpace(document, 90);
  addPdfSectionTitle(document, title);

  const startX = document.page.margins.left;
  const contentWidth = getPdfContentWidth(document);
  const labelWidth = 118;

  rows.forEach(([label, value], index) => {
    const availableValueWidth = contentWidth - labelWidth - 24;
    const valueHeight = document
      .font('Helvetica')
      .fontSize(8.5)
      .heightOfString(value, { width: availableValueWidth });
    const rowHeight = Math.max(30, valueHeight + 16);

    ensurePdfSpace(document, rowHeight + 4);

    const rowY = document.y;
    document
      .roundedRect(startX, rowY, contentWidth, rowHeight, 3)
      .fillAndStroke(index % 2 === 0 ? '#F7FAFC' : '#FFFFFF', PDF_BORDER);
    document
      .fillColor(PDF_BLUE)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(label.toUpperCase(), startX + 10, rowY + 10, {
        width: labelWidth,
      });
    document
      .fillColor('#111827')
      .font('Helvetica')
      .fontSize(8.5)
      .text(value, startX + labelWidth + 12, rowY + 9, {
        width: availableValueWidth,
      });
    document.y = rowY + rowHeight + 4;
    document.x = document.page.margins.left;
  });

  document.moveDown(0.4);
  document.x = document.page.margins.left;
  document.fillColor('#111827').font('Helvetica');
}

function addPdfSection(
  document: PDFKit.PDFDocument,
  title: string,
  rows: readonly (readonly [string, string])[],
): void {
  ensurePdfSpace(document, 80);
  addPdfSectionTitle(document, title);
  document.x = document.page.margins.left;
  document.font('Helvetica').fontSize(10);
  rows.forEach(([label, value]) => {
    document.moveDown(0.25);
    document.font('Helvetica-Bold').fillColor(PDF_BLUE).text(`${label}: `, { continued: true });
    document.fillColor('#111827');
    document.font('Helvetica').text(value);
  });
  document.moveDown();
  document.x = document.page.margins.left;
}

function addPdfTable(
  document: PDFKit.PDFDocument,
  title: string,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): void {
  ensurePdfSpace(document, 90);
  document.x = document.page.margins.left;
  document.fontSize(12).font('Helvetica-Bold').fillColor(PDF_BLUE).text(title);
  document.font('Helvetica').fontSize(8).fillColor('#111827');

  if (rows.length === 0) {
    document.moveDown(0.4).text('Sin registros.');
    document.moveDown();
    return;
  }

  document.moveDown(0.4);
  drawPdfTableRow(document, headers, true, false);
  rows.forEach((row, index) => {
    drawPdfTableRow(document, row, false, index % 2 === 1);
  });
  document.moveDown();
  document.x = document.page.margins.left;
}

function drawPdfTableRow(
  document: PDFKit.PDFDocument,
  row: readonly string[],
  isHeader: boolean,
  isAlternate: boolean,
): void {
  const rowHeight = isHeader ? 24 : 28;
  ensurePdfSpace(document, rowHeight + 6);
  const startX = document.page.margins.left;
  const contentWidth = getPdfContentWidth(document);
  const columnWidth = contentWidth / row.length;
  const startY = document.y;

  if (isHeader) {
    document.rect(startX, startY, contentWidth, rowHeight).fill(PDF_BLUE);
  } else if (isAlternate) {
    document.rect(startX, startY, contentWidth, rowHeight).fill('#F7FAFC');
  }

  row.forEach((value, index) => {
    const cellX = startX + columnWidth * index;
    document.rect(cellX, startY, columnWidth, rowHeight).strokeColor(PDF_BORDER).stroke();
    document
      .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isHeader ? 7.5 : 7)
      .fillColor(isHeader ? '#FFFFFF' : '#111827')
      .text(ellipsize(value, isHeader ? 18 : 34), cellX + 4, startY + 6, {
        width: columnWidth - 8,
        height: rowHeight - 8,
      });
  });

  document.y = startY + rowHeight;
  document.x = document.page.margins.left;
  document.fillColor('#111827').font('Helvetica');
}

function ensurePdfSpace(document: PDFKit.PDFDocument, requiredSpace: number): void {
  const bottom = document.page.height - document.page.margins.bottom;

  if (document.y + requiredSpace > bottom) {
    document.addPage();
    document.x = document.page.margins.left;
  }
}

function getPdfContentWidth(document: PDFKit.PDFDocument): number {
  return document.page.width - document.page.margins.left - document.page.margins.right;
}

function ellipsize(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}.` : value;
}

function mapTask(task: Task): ExportTask {
  return {
    uuid: task.uuid,
    projectUuid: task.projectUuid,
    parentTaskUuid: task.parentTaskUuid,
    name: task.name,
    description: task.description,
    startDate: task.startDate,
    endDate: task.endDate,
    status: task.status,
    progress: task.progress,
    estimatedHours: task.estimatedHours,
    plannedBudget: task.plannedBudget,
    actualCost: task.actualCost,
  };
}

function mapSafeUser(user: User): ExportUser {
  return {
    uuid: user.uuid,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function mapResource(assignment: ResourceAssignment): ExportResource {
  return {
    uuid: assignment.resource.uuid,
    code: assignment.resource.code,
    name: assignment.resource.name,
    category: assignment.resource.category,
    operationalStatus: assignment.resource.operationalStatus,
    description: assignment.resource.description,
    serialNumber: assignment.resource.serialNumber,
    isActive: assignment.resource.isActive,
  };
}

function uniqueResources(assignments: readonly ExportResourceAssignment[]): ExportResource[] {
  const resourcesByUuid = new Map<string, ExportResource>();

  assignments.forEach((assignment) => {
    resourcesByUuid.set(assignment.resource.uuid, assignment.resource);
  });

  return Array.from(resourcesByUuid.values()).sort((firstResource, secondResource) =>
    firstResource.code.localeCompare(secondResource.code),
  );
}

function buildFinancialSummary(project: Project, tasks: readonly Task[]): ExportFinancialSummary {
  const distributedBudget = addMoney(...tasks.map((task) => task.plannedBudget));
  const totalActualCost = addMoney(...tasks.map((task) => task.actualCost));
  const balance = subtractMoney(project.approvedBudget, totalActualCost);

  return {
    approvedBudget: project.approvedBudget,
    distributedBudget,
    totalActualCost,
    balance,
    consumedPercentage: calculatePercentage(totalActualCost, project.approvedBudget),
  };
}

function calculateAverageProgress(tasks: readonly Task[]): string {
  if (tasks.length === 0) {
    return '0.00';
  }

  return (tasks.reduce((total, task) => total + task.progress, 0) / tasks.length).toFixed(2);
}

function calculateInclusiveDateDays(startDate: string, endDate: string): number {
  const startTime = parseDateOnlyUtcNoon(startDate).getTime();
  const endTime = parseDateOnlyUtcNoon(endDate).getTime();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((endTime - startTime) / millisecondsPerDay) + 1;
}

function flattenExportGanttTasks(tasks: readonly ExportTask[]): ExportGanttTask[] {
  const childrenByParentUuid = new Map<string | null, ExportTask[]>();

  tasks.forEach((task) => {
    const siblings = childrenByParentUuid.get(task.parentTaskUuid) ?? [];
    siblings.push(task);
    childrenByParentUuid.set(task.parentTaskUuid, siblings);
  });

  childrenByParentUuid.forEach((siblings) => {
    siblings.sort((firstTask, secondTask) => {
      const startComparison = firstTask.startDate.localeCompare(secondTask.startDate);

      return startComparison === 0
        ? firstTask.name.localeCompare(secondTask.name)
        : startComparison;
    });
  });

  const flattenedTasks: ExportGanttTask[] = [];
  const visitedTaskUuids = new Set<string>();

  const visit = (parentTaskUuid: string | null, level: number) => {
    const children = childrenByParentUuid.get(parentTaskUuid) ?? [];

    children.forEach((task) => {
      if (visitedTaskUuids.has(task.uuid)) {
        return;
      }

      visitedTaskUuids.add(task.uuid);
      flattenedTasks.push({ task, level });
      visit(task.uuid, level + 1);
    });
  };

  visit(null, 0);

  tasks.forEach((task) => {
    if (!visitedTaskUuids.has(task.uuid)) {
      flattenedTasks.push({ task, level: 0 });
    }
  });

  return flattenedTasks;
}

function getResponsibleNames(taskUuid: string, assignments: readonly ExportAssignment[]): string {
  const taskAssignments = assignments.filter((assignment) => assignment.taskUuid === taskUuid);

  if (taskAssignments.length === 0) {
    return 'Sin responsables';
  }

  return taskAssignments
    .map((assignment) =>
      assignment.isMainResponsible ? `${assignment.user.name} (principal)` : assignment.user.name,
    )
    .join(', ');
}

function getMainResponsibleName(
  taskUuid: string,
  assignments: readonly ExportAssignment[],
): string {
  const assignment = assignments.find(
    (candidate) => candidate.taskUuid === taskUuid && candidate.isMainResponsible,
  );

  return assignment?.user.name ?? '';
}

function getTaskName(taskUuid: string, tasks: readonly ExportTask[]): string {
  return tasks.find((task) => task.uuid === taskUuid)?.name ?? taskUuid;
}

function buildDependencySummary(
  taskUuid: string,
  tasks: readonly ExportTask[],
  dependencies: readonly ExportDependency[],
): string {
  const predecessors = getPredecessorNames(taskUuid, tasks, dependencies);
  const successors = getSuccessorNames(taskUuid, tasks, dependencies);
  const parts = [];

  if (predecessors.length > 0) {
    parts.push(`Predecesoras: ${predecessors}`);
  }

  if (successors.length > 0) {
    parts.push(`Sucesoras: ${successors}`);
  }

  return parts.length === 0 ? 'Sin dependencias' : parts.join('; ');
}

function getPredecessorNames(
  taskUuid: string,
  tasks: readonly ExportTask[],
  dependencies: readonly ExportDependency[],
): string {
  return dependencies
    .filter((dependency) => dependency.successorTaskUuid === taskUuid)
    .map((dependency) => getTaskName(dependency.predecessorTaskUuid, tasks))
    .join(', ');
}

function getSuccessorNames(
  taskUuid: string,
  tasks: readonly ExportTask[],
  dependencies: readonly ExportDependency[],
): string {
  return dependencies
    .filter((dependency) => dependency.predecessorTaskUuid === taskUuid)
    .map((dependency) => getTaskName(dependency.successorTaskUuid, tasks))
    .join(', ');
}

interface GanttTimeBucket {
  label: string;
  startDate: string;
  endDate: string;
  width: number;
}

function buildGanttTimeBuckets(projectStartDate: string, projectEndDate: string): GanttTimeBucket[] {
  const projectDays = calculateInclusiveDateDays(projectStartDate, projectEndDate);

  if (projectDays <= 92) {
    return buildDailyGanttBuckets(projectStartDate, projectEndDate);
  }

  if (projectDays <= 370) {
    return buildWeeklyGanttBuckets(projectStartDate, projectEndDate);
  }

  return buildMonthlyGanttBuckets(projectStartDate, projectEndDate);
}

function buildDailyGanttBuckets(startDate: string, endDate: string): GanttTimeBucket[] {
  const buckets: GanttTimeBucket[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    buckets.push({
      label: cursor.slice(5),
      startDate: cursor,
      endDate: cursor,
      width: 7,
    });
    cursor = addDays(cursor, 1);
  }

  return buckets;
}

function buildWeeklyGanttBuckets(startDate: string, endDate: string): GanttTimeBucket[] {
  const buckets: GanttTimeBucket[] = [];
  let cursor = startDate;
  let week = 1;

  while (cursor <= endDate) {
    const bucketEndDate = minDateOnly(addDays(cursor, 6), endDate);
    buckets.push({
      label: `S${week.toString()} ${cursor.slice(5)}`,
      startDate: cursor,
      endDate: bucketEndDate,
      width: 12,
    });
    cursor = addDays(bucketEndDate, 1);
    week += 1;
  }

  return buckets;
}

function buildMonthlyGanttBuckets(startDate: string, endDate: string): GanttTimeBucket[] {
  const buckets: GanttTimeBucket[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    const monthEndDate = minDateOnly(getMonthEndDate(cursor), endDate);
    buckets.push({
      label: cursor.slice(0, 7),
      startDate: cursor,
      endDate: monthEndDate,
      width: 12,
    });
    cursor = addDays(monthEndDate, 1);
  }

  return buckets;
}

function rangesOverlap(
  firstStartDate: string,
  firstEndDate: string,
  secondStartDate: string,
  secondEndDate: string,
): boolean {
  return firstStartDate <= secondEndDate && firstEndDate >= secondStartDate;
}

function minDateOnly(firstDate: string, secondDate: string): string {
  return firstDate <= secondDate ? firstDate : secondDate;
}

function getMonthEndDate(date: string): string {
  const [yearText, monthText] = date.split('-');
  const yearSegment = yearText ?? '0000';
  const monthSegment = monthText ?? '01';
  const year = Number.parseInt(yearSegment, 10);
  const month = Number.parseInt(monthSegment, 10);
  const lastDay = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();

  return `${yearSegment}-${monthSegment}-${lastDay.toString().padStart(2, '0')}`;
}

function addDays(date: string, days: number): string {
  const value = parseDateOnlyUtcNoon(date);
  value.setUTCDate(value.getUTCDate() + days);

  return formatDateOnly(value);
}

function parseDateOnlyUtcNoon(date: string): Date {
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number.parseInt(yearText ?? '', 10);
  const month = Number.parseInt(monthText ?? '', 10);
  const day = Number.parseInt(dayText ?? '', 10);

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDateTimeInLaPaz(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPLAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')} ${getPart(
    parts,
    'hour',
  )}:${getPart(parts, 'minute')}:${getPart(parts, 'second')} America/La_Paz`;
}

function formatFileDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPLAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return `${getPart(parts, 'year')}${getPart(parts, 'month')}${getPart(parts, 'day')}-${getPart(
    parts,
    'hour',
  )}${getPart(parts, 'minute')}`;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((candidate) => candidate.type === type);

  if (part === undefined) {
    throw new Error(`No se pudo obtener ${type} para America/La_Paz.`);
  }

  return part.value;
}
