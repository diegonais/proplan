import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { ResourceCategory } from '../../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';

export enum ResourceSortField {
  NAME = 'name',
  CODE = 'code',
  CATEGORY = 'category',
  OPERATIONAL_STATUS = 'operationalStatus',
  IS_ACTIVE = 'isActive',
  CREATED_AT = 'createdAt',
}

export enum ResourceSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListResourcesQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @ApiPropertyOptional({ example: 'laptop', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ enum: ResourceCategory, example: ResourceCategory.LAPTOP })
  @IsOptional()
  @IsEnum(ResourceCategory)
  category?: ResourceCategory;

  @ApiPropertyOptional({
    enum: ResourceOperationalStatus,
    example: ResourceOperationalStatus.OPERATIONAL,
  })
  @IsOptional()
  @IsEnum(ResourceOperationalStatus)
  operationalStatus?: ResourceOperationalStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ResourceSortField, default: ResourceSortField.CREATED_AT })
  @IsOptional()
  @IsEnum(ResourceSortField)
  orderBy: ResourceSortField = ResourceSortField.CREATED_AT;

  @ApiPropertyOptional({ enum: ResourceSortOrder, default: ResourceSortOrder.DESC })
  @IsOptional()
  @IsEnum(ResourceSortOrder)
  order: ResourceSortOrder = ResourceSortOrder.DESC;
}
