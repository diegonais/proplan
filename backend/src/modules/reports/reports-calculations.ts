import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import {
  addMoney,
  calculatePercentage,
  compareMoney,
} from '../../common/utils/decimal-money';

export const PROPLAN_TIME_ZONE = 'America/La_Paz';
export const OVERDUE_TASKS_RED_THRESHOLD = 30;
export const BUDGET_WARNING_THRESHOLD = 80;

export enum TrafficLightColor {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export interface ProjectStatusInput {
  uuid: string;
  endDate: string;
  status: ProjectStatus;
  approvedBudget: string;
}

export interface TaskStatusInput {
  uuid: string;
  name: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  actualCost: string;
}

export interface OverdueTaskSummary {
  uuid: string;
  name: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
}

export interface TrafficLightCalculation {
  color: TrafficLightColor;
  reasons: string[];
  today: string;
  totalActualCost: string;
  approvedBudget: string;
  consumedPercentage: string;
  overdueTasksPercentage: string;
  overdueTasksCount: number;
  activeNonCancelledTasksCount: number;
  isProjectOverdue: boolean;
  overdueTasks: OverdueTaskSummary[];
}

export function calculateTrafficLight(
  project: ProjectStatusInput,
  tasks: readonly TaskStatusInput[],
  today: string,
): TrafficLightCalculation {
  const activeNonCancelledTasks = tasks.filter((task) => task.status !== TaskStatus.CANCELLED);
  const overdueTasks = activeNonCancelledTasks.filter((task) => isTaskOverdue(task, today));
  const totalActualCost = addMoney(...activeNonCancelledTasks.map((task) => task.actualCost));
  const consumedPercentage = calculateConsumptionPercentage(totalActualCost, project.approvedBudget);
  const overdueTasksPercentage = calculateRatioPercentage(
    overdueTasks.length,
    activeNonCancelledTasks.length,
  );
  const isProjectOverdue =
    project.endDate < today &&
    project.status !== ProjectStatus.COMPLETED &&
    project.status !== ProjectStatus.CANCELLED;

  const redReasons: string[] = [];

  if (compareMoney(totalActualCost, project.approvedBudget) > 0) {
    redReasons.push('El costo ejecutado supera el presupuesto aprobado.');
  }

  if (isProjectOverdue) {
    redReasons.push('El proyecto supero su fecha de fin y no esta finalizado ni cancelado.');
  }

  if (Number(overdueTasksPercentage) >= OVERDUE_TASKS_RED_THRESHOLD) {
    redReasons.push('El porcentaje de actividades vencidas es mayor o igual a 30%.');
  }

  if (redReasons.length > 0) {
    return buildResult({
      color: TrafficLightColor.RED,
      reasons: redReasons,
      project,
      totalActualCost,
      consumedPercentage,
      overdueTasksPercentage,
      overdueTasks,
      activeNonCancelledTasksCount: activeNonCancelledTasks.length,
      isProjectOverdue,
      today,
    });
  }

  const yellowReasons: string[] = [];
  const consumedNumber = Number(consumedPercentage);

  if (consumedNumber >= BUDGET_WARNING_THRESHOLD && consumedNumber <= 100) {
    yellowReasons.push('El consumo del presupuesto esta entre 80% y 100%.');
  }

  if (overdueTasks.length > 0) {
    yellowReasons.push('Existe al menos una actividad vencida y el porcentaje es menor a 30%.');
  }

  if (yellowReasons.length > 0) {
    return buildResult({
      color: TrafficLightColor.YELLOW,
      reasons: yellowReasons,
      project,
      totalActualCost,
      consumedPercentage,
      overdueTasksPercentage,
      overdueTasks,
      activeNonCancelledTasksCount: activeNonCancelledTasks.length,
      isProjectOverdue,
      today,
    });
  }

  return buildResult({
    color: TrafficLightColor.GREEN,
    reasons: [
      'No existen actividades vencidas, el consumo es inferior a 80% y el proyecto no esta vencido.',
    ],
    project,
    totalActualCost,
    consumedPercentage,
    overdueTasksPercentage,
    overdueTasks,
    activeNonCancelledTasksCount: activeNonCancelledTasks.length,
    isProjectOverdue,
    today,
  });
}

export function getTodayInLaPaz(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PROPLAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = findDatePart(parts, 'year');
  const month = findDatePart(parts, 'month');
  const day = findDatePart(parts, 'day');

  return `${year}-${month}-${day}`;
}

function isTaskOverdue(task: TaskStatusInput, today: string): boolean {
  return (
    task.endDate < today &&
    task.progress < 100 &&
    task.status !== TaskStatus.COMPLETED &&
    task.status !== TaskStatus.CANCELLED
  );
}

function calculateConsumptionPercentage(totalActualCost: string, approvedBudget: string): string {
  if (compareMoney(approvedBudget, '0.00') === 0) {
    return compareMoney(totalActualCost, '0.00') === 0 ? '0.00' : '100.00';
  }

  return calculatePercentage(totalActualCost, approvedBudget) ?? '0.00';
}

function calculateRatioPercentage(numerator: number, denominator: number): string {
  if (denominator === 0) {
    return '0.00';
  }

  return ((numerator / denominator) * 100).toFixed(2);
}

function buildResult(input: {
  color: TrafficLightColor;
  reasons: string[];
  project: ProjectStatusInput;
  totalActualCost: string;
  consumedPercentage: string;
  overdueTasksPercentage: string;
  overdueTasks: readonly TaskStatusInput[];
  activeNonCancelledTasksCount: number;
  isProjectOverdue: boolean;
  today: string;
}): TrafficLightCalculation {
  return {
    color: input.color,
    reasons: input.reasons,
    today: input.today,
    totalActualCost: input.totalActualCost,
    approvedBudget: input.project.approvedBudget,
    consumedPercentage: input.consumedPercentage,
    overdueTasksPercentage: input.overdueTasksPercentage,
    overdueTasksCount: input.overdueTasks.length,
    activeNonCancelledTasksCount: input.activeNonCancelledTasksCount,
    isProjectOverdue: input.isProjectOverdue,
    overdueTasks: input.overdueTasks.map((task) => ({
      uuid: task.uuid,
      name: task.name,
      endDate: task.endDate,
      status: task.status,
      progress: task.progress,
    })),
  };
}

function findDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((candidate) => candidate.type === type);

  if (part === undefined) {
    throw new Error(`No se pudo obtener la parte ${type} de la fecha America/La_Paz.`);
  }

  return part.value;
}
