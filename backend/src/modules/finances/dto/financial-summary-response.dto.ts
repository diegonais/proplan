import { ApiProperty } from '@nestjs/swagger';

import { TaskStatus } from '../../../common/enums/task-status.enum';
import {
  addMoney,
  calculatePercentage,
  compareMoney,
  subtractMoney,
} from '../../../common/utils/decimal-money';
import { Project } from '../../projects/entities/project.entity';
import { Task } from '../../tasks/entities/task.entity';

export class TaskFinancialSummaryItemResponseDto {
  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  uuid!: string;

  @ApiProperty({ example: 'Levantamiento de requerimientos' })
  name!: string;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.IN_PROGRESS })
  status!: TaskStatus;

  @ApiProperty({ example: '1500.00', description: 'String decimal sin perdida de precision.' })
  plannedBudget!: string;

  @ApiProperty({ example: '900.50', description: 'String decimal sin perdida de precision.' })
  actualCost!: string;

  @ApiProperty({ example: '599.50', description: 'plannedBudget - actualCost.' })
  variance!: string;

  @ApiProperty({
    example: '60.03',
    nullable: true,
    description: 'actualCost / plannedBudget * 100. Null cuando plannedBudget es 0.',
  })
  consumedPercentage!: string | null;

  static fromEntity(task: Task): TaskFinancialSummaryItemResponseDto {
    return {
      uuid: task.uuid,
      name: task.name,
      status: task.status,
      plannedBudget: task.plannedBudget,
      actualCost: task.actualCost,
      variance: subtractMoney(task.plannedBudget, task.actualCost),
      consumedPercentage: calculatePercentage(task.actualCost, task.plannedBudget),
    };
  }
}

export class ProjectFinancialSummaryResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: '15000.00', description: 'Presupuesto aprobado como string decimal.' })
  approvedBudget!: string;

  @ApiProperty({
    example: '8300.00',
    description: 'Suma de plannedBudget de actividades no eliminadas ni canceladas.',
  })
  distributedBudget!: string;

  @ApiProperty({
    example: '9250.50',
    description: 'Suma de actualCost de actividades no eliminadas ni canceladas.',
  })
  totalActualCost!: string;

  @ApiProperty({ example: '5749.50', description: 'approvedBudget - totalActualCost.' })
  balance!: string;

  @ApiProperty({ example: '5749.50', description: 'approvedBudget - totalActualCost.' })
  variance!: string;

  @ApiProperty({
    example: '61.67',
    nullable: true,
    description: 'totalActualCost / approvedBudget * 100. Null cuando approvedBudget es 0.',
  })
  consumedPercentage!: string | null;

  @ApiProperty({
    example: '-6700.00',
    description: 'distributedBudget - approvedBudget. Positivo indica presupuesto sobredistribuido.',
  })
  distributedBudgetDifference!: string;

  @ApiProperty({ example: false })
  budgetExceeded!: boolean;

  @ApiProperty({
    example:
      'Se excluyen actividades eliminadas logicamente y actividades CANCELLED del presupuesto operativo.',
  })
  operationalBudgetPolicy!: string;

  @ApiProperty({ type: [TaskFinancialSummaryItemResponseDto] })
  tasks!: TaskFinancialSummaryItemResponseDto[];

  static fromEntities(project: Project, tasks: readonly Task[]): ProjectFinancialSummaryResponseDto {
    const distributedBudget = addMoney(...tasks.map((task) => task.plannedBudget));
    const totalActualCost = addMoney(...tasks.map((task) => task.actualCost));
    const balance = subtractMoney(project.approvedBudget, totalActualCost);

    return {
      projectUuid: project.uuid,
      approvedBudget: project.approvedBudget,
      distributedBudget,
      totalActualCost,
      balance,
      variance: balance,
      consumedPercentage: calculatePercentage(totalActualCost, project.approvedBudget),
      distributedBudgetDifference: subtractMoney(distributedBudget, project.approvedBudget),
      budgetExceeded: compareMoney(totalActualCost, project.approvedBudget) > 0,
      operationalBudgetPolicy:
        'Se excluyen actividades eliminadas logicamente y actividades CANCELLED del presupuesto operativo.',
      tasks: tasks.map((task) => TaskFinancialSummaryItemResponseDto.fromEntity(task)),
    };
  }
}
