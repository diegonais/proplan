import { addMoney, compareMoney } from './decimal-money';

export const PROJECT_BUDGET_LIMIT_MESSAGE =
  'El presupuesto planificado total de las actividades no puede superar el presupuesto aprobado del proyecto.';

export function calculateDistributedBudget(plannedBudgets: readonly string[]): string {
  return addMoney(...plannedBudgets);
}

export function exceedsApprovedBudget(
  approvedBudget: string,
  plannedBudgets: readonly string[],
): boolean {
  return compareMoney(calculateDistributedBudget(plannedBudgets), approvedBudget) > 0;
}
