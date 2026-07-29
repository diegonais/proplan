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

export interface GeneratedExportFile {
  buffer: Buffer;
  contentType: string;
  fileName: string;
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
  ) {}

  async generateProjectPdf(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<GeneratedExportFile> {
    const data = await this.getExportData(projectUuid, currentUser);
    const buffer = await buildPdf(data);

    return {
      buffer,
      contentType: PDF_CONTENT_TYPE,
      fileName: buildExportFileName(data.project.name, data.project.uuid, data.generatedAt, 'pdf'),
    };
  }

  async generateProjectExcel(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<GeneratedExportFile> {
    const data = await this.getExportData(projectUuid, currentUser);
    const buffer = await buildExcel(data);

    return {
      buffer,
      contentType: EXCEL_CONTENT_TYPE,
      fileName: buildExportFileName(data.project.name, data.project.uuid, data.generatedAt, 'xlsx'),
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

async function buildPdf(data: ExportProjectData): Promise<Buffer> {
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

  addPdfHeader(document, data);
  addPdfSection(document, 'Proyecto', [
    ['Nombre', data.project.name],
    ['Objetivo', data.project.objective],
    ['Descripcion', data.project.description ?? 'Sin descripcion'],
    ['Jefe', `${data.manager.name} (${data.manager.email})`],
    ['Fechas', `${data.project.startDate} a ${data.project.endDate}`],
    ['Estado', data.project.status],
    ['Progreso', `${data.progressPercentage}%`],
    ['Generado en America/La_Paz', data.generatedAtLabel],
  ]);
  addPdfSection(document, 'Semaforo', [
    ['Estado', data.trafficLight.color],
    ['Razones', data.trafficLight.reasons.join('; ')],
  ]);
  addPdfTable(
    document,
    'Equipo',
    ['Nombre', 'Correo', 'Rol'],
    data.members.map((member) => [member.user.name, member.user.email, member.user.role]),
  );
  addPdfTable(
    document,
    'Actividades y subactividades',
    ['Actividad', 'Responsables', 'Fechas', 'Estado', 'Progreso'],
    data.tasks.map((task) => [
      `${task.parentTaskUuid === null ? '' : 'Subactividad: '}${task.name}`,
      getResponsibleNames(task.uuid, data.assignments),
      `${task.startDate} a ${task.endDate}`,
      task.status,
      `${task.progress.toString()}%`,
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
  addPdfTable(
    document,
    'Recursos asignados',
    [
      'Codigo',
      'Nombre',
      'Categoria',
      'Estado operativo',
      'Proyecto',
      'Actividad',
      'Fecha inicial',
      'Fecha final',
      'Estado temporal',
    ],
    data.resourceAssignments.map((assignment) => [
      assignment.resource.code,
      assignment.resource.name,
      assignment.resource.category,
      assignment.resource.operationalStatus,
      assignment.projectName,
      assignment.taskName ?? 'Proyecto completo',
      assignment.startDate,
      assignment.endDate,
      assignment.temporalStatus,
    ]),
  );
  addPdfSection(document, 'Resumen financiero', [
    ['Presupuesto aprobado', data.financialSummary.approvedBudget],
    ['Presupuesto distribuido', data.financialSummary.distributedBudget],
    ['Costo ejecutado', data.financialSummary.totalActualCost],
    ['Saldo', data.financialSummary.balance],
    ['Consumo', `${data.financialSummary.consumedPercentage ?? '0.00'}%`],
  ]);

  document.end();

  return bufferPromise;
}

async function buildExcel(data: ExportProjectData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PROPLAN';
  workbook.created = data.generatedAt;
  workbook.modified = data.generatedAt;

  addProjectSheet(workbook, data);
  addTasksSheet(workbook, data);
  addAssignmentsSheet(workbook, data);
  addTeamSheet(workbook, data);
  addBudgetSheet(workbook, data);
  addDependenciesSheet(workbook, data);
  addResourcesSheet(workbook, data);
  addResourceAssignmentsSheet(workbook, data);

  const workbookBuffer = await workbook.xlsx.writeBuffer();

  return Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer);
}

function addProjectSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Proyecto');
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

function addTasksSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Actividades');
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

function addAssignmentsSheet(workbook: ExcelJS.Workbook, data: ExportProjectData): void {
  const worksheet = workbook.addWorksheet('Asignaciones');
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
): string {
  const dateStamp = formatFileDateTime(generatedAt);
  const safeProjectName = projectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const projectSegment = safeProjectName.length > 0 ? safeProjectName : 'proyecto';

  return `proplan-${projectSegment}-${projectUuid.slice(0, 8)}-${dateStamp}.${extension}`;
}

function formatHeader(worksheet: ExcelJS.Worksheet): void {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true };
  });
}

function addPdfHeader(document: PDFKit.PDFDocument, data: ExportProjectData): void {
  document.fontSize(18).text('Reporte de proyecto PROPLAN', { align: 'left' });
  document.moveDown(0.3);
  document.fontSize(10).fillColor('#555555').text(`Generado: ${data.generatedAtLabel}`);
  document.fillColor('#000000');
  document.moveDown();
}

function addPdfSection(
  document: PDFKit.PDFDocument,
  title: string,
  rows: readonly (readonly [string, string])[],
): void {
  ensurePdfSpace(document, 80);
  document.fontSize(13).font('Helvetica-Bold').text(title);
  document.font('Helvetica').fontSize(10);
  rows.forEach(([label, value]) => {
    document.moveDown(0.25);
    document.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    document.font('Helvetica').text(value);
  });
  document.moveDown();
}

function addPdfTable(
  document: PDFKit.PDFDocument,
  title: string,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): void {
  ensurePdfSpace(document, 90);
  document.fontSize(13).font('Helvetica-Bold').text(title);
  document.font('Helvetica').fontSize(9);

  if (rows.length === 0) {
    document.moveDown(0.4).text('Sin registros.');
    document.moveDown();
    return;
  }

  document.moveDown(0.4);
  document.font('Helvetica-Bold').text(headers.join(' | '));
  document.font('Helvetica');
  rows.forEach((row) => {
    ensurePdfSpace(document, 34);
    document.text(row.join(' | '));
  });
  document.moveDown();
}

function ensurePdfSpace(document: PDFKit.PDFDocument, requiredSpace: number): void {
  const bottom = document.page.height - document.page.margins.bottom;

  if (document.y + requiredSpace > bottom) {
    document.addPage();
  }
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
