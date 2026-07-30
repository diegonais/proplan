import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ResourceCategory } from '../../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';
import { ResourceAssignmentTemporalStatus } from '../../resource-assignments/dto/resource-assignment-temporal-status.enum';
import { ResourceCurrentAvailabilityStatus } from './resource-utilization-report-response.dto';
import { ReportUserResponseDto } from './report-common.dto';
import { ResourcesReportTypeFilter } from './resources-report-query.dto';

export enum ResourcesReportItemType {
  HUMAN = 'HUMAN',
  MATERIAL = 'MATERIAL',
}

export class ResourcesReportFiltersResponseDto {
  @ApiPropertyOptional({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string | null;

  @ApiProperty({ enum: ResourcesReportTypeFilter })
  resourceType!: ResourcesReportTypeFilter;

  @ApiPropertyOptional({ example: '2026-08' })
  month!: string | null;

  @ApiPropertyOptional({ example: '2026-08-01' })
  startDate!: string | null;

  @ApiPropertyOptional({ example: '2026-08-31' })
  endDate!: string | null;
}

export class ResourcesReportSummaryResponseDto {
  @ApiProperty({ example: 5 })
  totalHumanResources!: number;

  @ApiProperty({ example: 8 })
  totalMaterialResources!: number;

  @ApiProperty({ example: '120.00' })
  totalAssignedHours!: string;

  @ApiProperty({ example: 42 })
  totalMaterialAssignmentDays!: number;

  @ApiProperty({ example: 3 })
  activeMaterialAssignments!: number;
}

export class ResourcesReportItemResponseDto {
  @ApiProperty({ enum: ResourcesReportItemType })
  itemType!: ResourcesReportItemType;

  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: 'Implementacion ERP interno' })
  projectName!: string;

  @ApiPropertyOptional({ type: ReportUserResponseDto })
  user!: ReportUserResponseDto | null;

  @ApiPropertyOptional({ example: '6a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  resourceUuid!: string | null;

  @ApiProperty({ example: 'Ana Choque' })
  resourceName!: string;

  @ApiPropertyOptional({ example: 'LAP-LOG-001' })
  resourceCode!: string | null;

  @ApiPropertyOptional({ enum: ResourceCategory })
  resourceCategory!: ResourceCategory | null;

  @ApiPropertyOptional({ enum: ResourceOperationalStatus })
  operationalStatus!: ResourceOperationalStatus | null;

  @ApiPropertyOptional({ example: '32.00' })
  assignedHours!: string | null;

  @ApiPropertyOptional({ example: 15 })
  assignedDays!: number | null;

  @ApiPropertyOptional({ example: 'Actividad principal' })
  taskName!: string | null;

  @ApiPropertyOptional({ example: '2026-08-01' })
  startDate!: string | null;

  @ApiPropertyOptional({ example: '2026-08-15' })
  endDate!: string | null;

  @ApiPropertyOptional({ enum: ResourceAssignmentTemporalStatus })
  temporalStatus!: ResourceAssignmentTemporalStatus | null;

  @ApiPropertyOptional({ enum: ResourceCurrentAvailabilityStatus })
  currentAvailability!: ResourceCurrentAvailabilityStatus | null;

  @ApiPropertyOptional({ example: 'Asignado para pruebas de integracion.' })
  authorizedNotes!: string | null;
}

export class ResourcesReportResponseDto {
  @ApiProperty({
    example: 'Las fechas se exponen como YYYY-MM-DD sin conversion de zona horaria.',
  })
  datePolicy!: string;

  @ApiProperty({ example: '2026-07-29' })
  today!: string;

  @ApiProperty({ type: ResourcesReportFiltersResponseDto })
  filters!: ResourcesReportFiltersResponseDto;

  @ApiProperty({ type: ResourcesReportSummaryResponseDto })
  summary!: ResourcesReportSummaryResponseDto;

  @ApiProperty({ type: [ResourcesReportItemResponseDto] })
  items!: ResourcesReportItemResponseDto[];
}
