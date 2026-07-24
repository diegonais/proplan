import { ApiProperty } from '@nestjs/swagger';

import { ProjectStatus } from '../../../common/enums/project-status.enum';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { TrafficLightReportResponseDto } from './report-common.dto';

export class TaskStatusCountResponseDto {
  @ApiProperty({ enum: TaskStatus, example: TaskStatus.PENDING })
  status!: TaskStatus;

  @ApiProperty({ example: 3 })
  count!: number;
}

export class ProjectStatusReportResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: 'Implementacion ERP interno' })
  projectName!: string;

  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.IN_PROGRESS })
  projectStatus!: ProjectStatus;

  @ApiProperty({ example: '2026-08-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-12-15' })
  endDate!: string;

  @ApiProperty({ example: '45.00' })
  progressPercentage!: string;

  @ApiProperty({ example: 8 })
  totalTasks!: number;

  @ApiProperty({ example: 7 })
  activeNonCancelledTasks!: number;

  @ApiProperty({ type: [TaskStatusCountResponseDto] })
  taskStatusCounts!: TaskStatusCountResponseDto[];

  @ApiProperty({ type: TrafficLightReportResponseDto })
  trafficLight!: TrafficLightReportResponseDto;
}
