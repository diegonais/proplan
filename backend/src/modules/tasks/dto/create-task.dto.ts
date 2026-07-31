import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TaskStatus } from '../../../common/enums/task-status.enum';
import {
  normalizeMoneyInput,
  normalizedDecimalMoneyPattern,
} from '../../../common/utils/decimal-money';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateTaskDto {
  @ApiProperty({ example: 'Levantamiento de requerimientos', maxLength: 180 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({ example: 'Reunion con usuarios clave.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => normalizeOptionalText(value))
  description?: string | null;

  @ApiProperty({ example: '2026-08-05', pattern: 'YYYY-MM-DD' })
  @IsString()
  @Matches(dateOnlyPattern, { message: 'startDate debe usar el formato YYYY-MM-DD.' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-12', pattern: 'YYYY-MM-DD' })
  @IsString()
  @Matches(dateOnlyPattern, { message: 'endDate debe usar el formato YYYY-MM-DD.' })
  endDate!: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.PENDING })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 100, default: 0 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNumberInput(value))
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({ example: 24, minimum: 0, default: 0 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNumberInput(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional({
    example: '1500.00',
    minimum: 0,
    default: '0.00',
    description: 'Monto decimal no negativo. La API serializa valores monetarios como strings.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeMoneyInput(value))
  @IsString()
  @Matches(normalizedDecimalMoneyPattern, {
    message: 'plannedBudget debe ser un decimal no negativo con maximo 2 decimales.',
  })
  plannedBudget?: string;

  @ApiPropertyOptional({
    example: '0.00',
    minimum: 0,
    default: '0.00',
    description: 'Monto decimal no negativo. La API serializa valores monetarios como strings.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeMoneyInput(value))
  @IsString()
  @Matches(normalizedDecimalMoneyPattern, {
    message: 'actualCost debe ser un decimal no negativo con maximo 2 decimales.',
  })
  actualCost?: string;

  @ApiPropertyOptional({
    example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1',
    description:
      'UUID de una actividad padre de primer nivel cuando se crea una subactividad. No se permiten mas de dos niveles.',
  })
  @IsOptional()
  @IsUUID()
  parentTaskUuid?: string | null;
}

function normalizeOptionalText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeNumberInput(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return value;
}
