import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateResourceAssignmentDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  @IsUUID()
  resourceUuid!: string;

  @ApiPropertyOptional({ example: '7a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541', nullable: true })
  @IsOptional()
  @IsUUID()
  taskUuid?: string;

  @ApiProperty({ example: '2026-08-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate debe usar el formato YYYY-MM-DD.' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate debe usar el formato YYYY-MM-DD.' })
  endDate!: string;

  @ApiPropertyOptional({ example: 'Asignado para pruebas de integracion.', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
