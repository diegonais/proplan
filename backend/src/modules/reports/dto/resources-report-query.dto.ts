import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, Matches, ValidateIf } from 'class-validator';

export enum ResourcesReportTypeFilter {
  ALL = 'ALL',
  HUMAN = 'HUMAN',
  MATERIAL = 'MATERIAL',
}

export class ResourcesReportQueryDto {
  @ApiPropertyOptional({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  @IsOptional()
  @IsUUID()
  projectUuid?: string;

  @ApiPropertyOptional({ enum: ResourcesReportTypeFilter, default: ResourcesReportTypeFilter.ALL })
  @IsOptional()
  @IsEnum(ResourcesReportTypeFilter)
  resourceType: ResourcesReportTypeFilter = ResourcesReportTypeFilter.ALL;

  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month debe usar el formato YYYY-MM.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  month?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @ValidateIf((query: ResourcesReportQueryDto) => query.month === undefined)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe usar el formato YYYY-MM-DD.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @ValidateIf((query: ResourcesReportQueryDto) => query.month === undefined)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate debe usar el formato YYYY-MM-DD.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  endDate?: string;
}
