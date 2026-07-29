import { ApiProperty } from '@nestjs/swagger';

import { ProjectStatus } from '../../../common/enums/project-status.enum';
import { TrafficLightColor } from '../reports-calculations';
import { WorkloadReportItemResponseDto } from './report-common.dto';

export class DashboardProjectSummaryResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: 'Implementacion ERP interno' })
  name!: string;

  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.IN_PROGRESS })
  status!: ProjectStatus;

  @ApiProperty({ example: '2026-08-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-12-15' })
  endDate!: string;

  @ApiProperty({ example: '45.00' })
  progressPercentage!: string;

  @ApiProperty({ enum: TrafficLightColor, example: TrafficLightColor.GREEN })
  trafficLight!: TrafficLightColor;
}

export class DashboardMilestoneResponseDto {
  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  taskUuid!: string;

  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: 'Implementacion ERP interno' })
  projectName!: string;

  @ApiProperty({ example: 'Validacion de alcance' })
  name!: string;

  @ApiProperty({ example: '2026-08-12' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  endDate!: string;

  @ApiProperty({ example: 20 })
  progress!: number;
}

export class DashboardReportResponseDto {
  @ApiProperty({ example: 4 })
  activeProjects!: number;

  @ApiProperty({ example: 12 })
  pendingTasks!: number;

  @ApiProperty({ example: 7 })
  visibleMembers!: number;

  @ApiProperty({ example: 18 })
  operationalResources!: number;

  @ApiProperty({ example: 6 })
  currentlyAssignedResources!: number;

  @ApiProperty({ example: 2 })
  resourcesInMaintenance!: number;

  @ApiProperty({ example: '52.50' })
  averageProgress!: string;

  @ApiProperty({ type: [DashboardProjectSummaryResponseDto] })
  projectSummaries!: DashboardProjectSummaryResponseDto[];

  @ApiProperty({ type: [DashboardMilestoneResponseDto] })
  upcomingMilestones!: DashboardMilestoneResponseDto[];

  @ApiProperty({ type: [WorkloadReportItemResponseDto] })
  workload!: WorkloadReportItemResponseDto[];

  @ApiProperty({ example: true })
  canViewFinancialDetails!: boolean;
}
