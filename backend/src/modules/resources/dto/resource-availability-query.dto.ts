import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class ResourceAvailabilityQueryDto {
  @ApiProperty({ example: '2026-08-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe usar el formato YYYY-MM-DD.' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate debe usar el formato YYYY-MM-DD.' })
  endDate!: string;
}
