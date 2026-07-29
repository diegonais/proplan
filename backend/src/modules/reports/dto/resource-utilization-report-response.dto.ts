import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ResourceCategory } from '../../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';
import { ProjectStatus } from '../../../common/enums/project-status.enum';
import { ResourceAssignmentTemporalStatus } from '../../resource-assignments/dto/resource-assignment-temporal-status.enum';

export enum ResourceCurrentAvailabilityStatus {
  AVAILABLE = 'DISPONIBLE',
  ASSIGNED = 'ASIGNADO',
  UNAVAILABLE = 'NO_DISPONIBLE',
  DELETED = 'ELIMINADO',
}

export class ResourceUtilizationProjectResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Implementacion TMS interno' })
  name!: string;

  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.IN_PROGRESS })
  status!: ProjectStatus;

  @ApiProperty({ example: '2026-08-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-12-15' })
  endDate!: string;
}

export class ResourceUtilizationTaskResponseDto {
  @ApiProperty({ example: '7a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Pruebas de integracion con GPS' })
  name!: string;
}

export class ResourceCategorySummaryResponseDto {
  @ApiProperty({ enum: ResourceCategory, example: ResourceCategory.LAPTOP })
  category!: ResourceCategory;

  @ApiProperty({ example: 4 })
  count!: number;
}

export class ResourceUtilizationSummaryResponseDto {
  @ApiProperty({ example: 6 })
  totalAssignedResources!: number;

  @ApiProperty({ example: 3 })
  activeAssignments!: number;

  @ApiProperty({ example: 2 })
  scheduledAssignments!: number;

  @ApiProperty({ example: 1 })
  finishedAssignments!: number;

  @ApiProperty({ type: [ResourceCategorySummaryResponseDto] })
  resourcesByCategory!: ResourceCategorySummaryResponseDto[];
}

export class ResourceUtilizationAssignmentResponseDto {
  @ApiProperty({ example: '9b1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: '6a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  resourceUuid!: string;

  @ApiProperty({ example: 'Laptop Dell Latitude 5440' })
  resourceName!: string;

  @ApiProperty({ example: 'LAP-LOG-001' })
  resourceCode!: string;

  @ApiProperty({ enum: ResourceCategory, example: ResourceCategory.LAPTOP })
  resourceCategory!: ResourceCategory;

  @ApiProperty({
    enum: ResourceOperationalStatus,
    example: ResourceOperationalStatus.OPERATIONAL,
  })
  operationalStatus!: ResourceOperationalStatus;

  @ApiPropertyOptional({ type: ResourceUtilizationTaskResponseDto, nullable: true })
  task!: ResourceUtilizationTaskResponseDto | null;

  @ApiProperty({ example: '2026-08-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  endDate!: string;

  @ApiProperty({ enum: ResourceAssignmentTemporalStatus })
  temporalStatus!: ResourceAssignmentTemporalStatus;

  @ApiProperty({ example: 15 })
  assignedDays!: number;

  @ApiProperty({ enum: ResourceCurrentAvailabilityStatus })
  currentAvailability!: ResourceCurrentAvailabilityStatus;

  @ApiPropertyOptional({ example: 'Asignado para pruebas de integracion.', nullable: true })
  authorizedNotes!: string | null;
}

export class ResourceUtilizationReportResponseDto {
  @ApiProperty({ type: ResourceUtilizationProjectResponseDto })
  project!: ResourceUtilizationProjectResponseDto;

  @ApiProperty({
    example: 'Las fechas se exponen como YYYY-MM-DD sin conversion de zona horaria.',
  })
  datePolicy!: string;

  @ApiProperty({ example: '2026-07-29' })
  today!: string;

  @ApiProperty({ type: ResourceUtilizationSummaryResponseDto })
  summary!: ResourceUtilizationSummaryResponseDto;

  @ApiProperty({ type: [ResourceUtilizationAssignmentResponseDto] })
  assignments!: ResourceUtilizationAssignmentResponseDto[];
}
