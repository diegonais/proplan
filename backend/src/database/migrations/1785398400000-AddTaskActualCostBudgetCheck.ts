import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskActualCostBudgetCheck1785398400000 implements MigrationInterface {
  name = 'AddTaskActualCostBudgetCheck1785398400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "CHK_tasks_actual_cost_within_planned_budget" CHECK ("actualCost" <= "plannedBudget")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "CHK_tasks_actual_cost_within_planned_budget"`,
    );
  }
}
