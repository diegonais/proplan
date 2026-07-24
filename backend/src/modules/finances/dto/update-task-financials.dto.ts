import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

import {
  normalizeMoneyInput,
  normalizedDecimalMoneyPattern,
} from '../../../common/utils/decimal-money';

export class UpdateTaskFinancialsDto {
  @ApiPropertyOptional({
    example: '1500.00',
    minimum: 0,
    description: 'Presupuesto planificado de la actividad como string decimal no negativo.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeMoneyInput(value))
  @IsString()
  @Matches(normalizedDecimalMoneyPattern, {
    message: 'plannedBudget debe ser un decimal no negativo con maximo 2 decimales.',
  })
  plannedBudget?: string;

  @ApiPropertyOptional({
    example: '900.50',
    minimum: 0,
    description: 'Costo ejecutado acumulado de la actividad como string decimal no negativo.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeMoneyInput(value))
  @IsString()
  @Matches(normalizedDecimalMoneyPattern, {
    message: 'actualCost debe ser un decimal no negativo con maximo 2 decimales.',
  })
  actualCost?: string;
}
