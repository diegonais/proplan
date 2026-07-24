import { ApiProperty } from '@nestjs/swagger';

import { TaskDependencyType } from '../../../common/enums/task-dependency-type.enum';
import { TaskStatus } from '../../../common/enums/task-status.enum';

export class GanttTaskReportItemResponseDto {
  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  uuid!: string;

  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: '9a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541', nullable: true })
  parentTaskUuid!: string | null;

  @ApiProperty({ example: 'Levantamiento de requerimientos' })
  name!: string;

  @ApiProperty({ example: '2026-08-05' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-12' })
  endDate!: string;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.IN_PROGRESS })
  status!: TaskStatus;

  @ApiProperty({ example: 45 })
  progress!: number;

  @ApiProperty({ example: 1 })
  level!: number;
}

export class GanttDependencyReportItemResponseDto {
  @ApiProperty({ example: '7a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  predecessorTaskUuid!: string;

  @ApiProperty({ example: '2bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  successorTaskUuid!: string;

  @ApiProperty({ enum: TaskDependencyType, example: TaskDependencyType.FINISH_TO_START })
  dependencyType!: TaskDependencyType;
}

export class GanttReportResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: 'Implementacion ERP interno' })
  projectName!: string;

  @ApiProperty({ example: '2026-08-01' })
  projectStartDate!: string;

  @ApiProperty({ example: '2026-12-15' })
  projectEndDate!: string;

  @ApiProperty({ example: 'Las fechas se exponen como YYYY-MM-DD sin conversion de zona horaria.' })
  datePolicy!: string;

  @ApiProperty({ type: [GanttTaskReportItemResponseDto] })
  tasks!: GanttTaskReportItemResponseDto[];

  @ApiProperty({ type: [GanttDependencyReportItemResponseDto] })
  dependencies!: GanttDependencyReportItemResponseDto[];
}
