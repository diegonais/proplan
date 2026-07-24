import { ApiProperty } from '@nestjs/swagger';

import { TaskStatus } from '../../../common/enums/task-status.enum';
import { UserRole } from '../../../common/enums/user-role.enum';
import { TrafficLightColor } from '../reports-calculations';

export class ReportUserResponseDto {
  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Diego Usuario' })
  name!: string;

  @ApiProperty({ example: 'usuario@proplan.local' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;
}

export class WorkloadReportItemResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  userUuid!: string;

  @ApiProperty({ type: ReportUserResponseDto })
  user!: ReportUserResponseDto;

  @ApiProperty({ example: '36.00' })
  assignedHours!: string;
}

export class OverdueTaskReportItemResponseDto {
  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  uuid!: string;

  @ApiProperty({ example: 'Levantamiento de requerimientos' })
  name!: string;

  @ApiProperty({ example: '2026-08-12' })
  endDate!: string;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.IN_PROGRESS })
  status!: TaskStatus;

  @ApiProperty({ example: 40 })
  progress!: number;
}

export class TrafficLightReportResponseDto {
  @ApiProperty({ enum: TrafficLightColor, example: TrafficLightColor.YELLOW })
  color!: TrafficLightColor;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty({ example: '2026-07-24' })
  today!: string;

  @ApiProperty({ example: '9000.00' })
  totalActualCost!: string;

  @ApiProperty({ example: '10000.00' })
  approvedBudget!: string;

  @ApiProperty({ example: '90.00' })
  consumedPercentage!: string;

  @ApiProperty({ example: '20.00' })
  overdueTasksPercentage!: string;

  @ApiProperty({ example: 1 })
  overdueTasksCount!: number;

  @ApiProperty({ example: 5 })
  activeNonCancelledTasksCount!: number;

  @ApiProperty({ example: false })
  isProjectOverdue!: boolean;

  @ApiProperty({ type: [OverdueTaskReportItemResponseDto] })
  overdueTasks!: OverdueTaskReportItemResponseDto[];

  @ApiProperty({ example: true })
  canViewFinancialDetails!: boolean;
}
