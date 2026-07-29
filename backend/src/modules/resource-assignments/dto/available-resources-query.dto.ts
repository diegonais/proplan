import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

export class AvailableResourcesQueryDto {
  @ApiProperty({ example: '2026-08-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe usar el formato YYYY-MM-DD.' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate debe usar el formato YYYY-MM-DD.' })
  endDate!: string;

  @ApiPropertyOptional({ example: '7a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  @IsOptional()
  @IsUUID()
  taskUuid?: string;
}
