import { addMoney, compareMoney } from './decimal-money';

export const PROJECT_BUDGET_LIMIT_MESSAGE =
  'El presupuesto planificado total de las actividades no puede superar el presupuesto aprobado del proyecto.';
export const TASK_ACTUAL_COST_LIMIT_MESSAGE =
  'El costo ejecutado de la actividad no puede superar su presupuesto planificado.';

export function calculateDistributedBudget(plannedBudgets: readonly string[]): string {
  return addMoney(...plannedBudgets);
}

export function exceedsApprovedBudget(
  approvedBudget: string,
  plannedBudgets: readonly string[],
): boolean {
  return compareMoney(calculateDistributedBudget(plannedBudgets), approvedBudget) > 0;
}

export function exceedsPlannedBudget(plannedBudget: string, actualCost: string): boolean {
  return compareMoney(actualCost, plannedBudget) > 0;
}
