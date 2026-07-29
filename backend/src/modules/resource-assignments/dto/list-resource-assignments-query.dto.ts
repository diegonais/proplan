import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';

import { ResourceCategory } from '../../../common/enums/resource-category.enum';
import { ResourceAssignmentTemporalStatus } from './resource-assignment-temporal-status.enum';

export class ListResourceAssignmentsQueryDto {
  @ApiPropertyOptional({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  @IsOptional()
  @IsUUID()
  resourceUuid?: string;

  @ApiPropertyOptional({ enum: ResourceCategory, example: ResourceCategory.LAPTOP })
  @IsOptional()
  @IsEnum(ResourceCategory)
  category?: ResourceCategory;

  @ApiPropertyOptional({ example: '7a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  @IsOptional()
  @IsUUID()
  taskUuid?: string;

  @ApiPropertyOptional({
    enum: ResourceAssignmentTemporalStatus,
    example: ResourceAssignmentTemporalStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ResourceAssignmentTemporalStatus)
  temporalStatus?: ResourceAssignmentTemporalStatus;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe usar el formato YYYY-MM-DD.' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate debe usar el formato YYYY-MM-DD.' })
  endDate?: string;
}
