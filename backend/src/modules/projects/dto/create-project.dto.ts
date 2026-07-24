import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { ProjectStatus } from '../../../common/enums/project-status.enum';
import {
  normalizeMoneyInput,
  normalizedDecimalMoneyPattern,
} from '../../../common/utils/decimal-money';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateProjectDto {
  @ApiProperty({ example: 'Implementacion ERP interno', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({ example: 'Proyecto de centralizacion de procesos administrativos.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalText(value))
  description?: string | null;

  @ApiProperty({ example: 'Centralizar la planificacion y seguimiento del proyecto.' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  objective!: string;

  @ApiProperty({ example: '2026-08-01', pattern: 'YYYY-MM-DD' })
  @IsString()
  @Matches(dateOnlyPattern, { message: 'startDate debe usar el formato YYYY-MM-DD.' })
  startDate!: string;

  @ApiProperty({ example: '2026-12-15', pattern: 'YYYY-MM-DD' })
  @IsString()
  @Matches(dateOnlyPattern, { message: 'endDate debe usar el formato YYYY-MM-DD.' })
  endDate!: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.PLANNING })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    example: '15000.00',
    minimum: 0,
    default: '0.00',
    description: 'Monto decimal no negativo. La API serializa valores monetarios como strings.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeMoneyInput(value))
  @IsString()
  @Matches(normalizedDecimalMoneyPattern, {
    message: 'approvedBudget debe ser un decimal no negativo con maximo 2 decimales.',
  })
  approvedBudget?: string;

  @ApiPropertyOptional({
    example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541',
    description: 'Obligatorio para Administrador. Ignorado para Jefe de proyecto.',
  })
  @IsOptional()
  @IsUUID()
  managerUuid?: string;
}

function normalizeOptionalText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}
