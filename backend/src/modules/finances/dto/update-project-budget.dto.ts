import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

import {
  normalizeMoneyInput,
  normalizedDecimalMoneyPattern,
} from '../../../common/utils/decimal-money';

export class UpdateProjectBudgetDto {
  @ApiProperty({
    example: '15000.00',
    minimum: 0,
    description: 'Presupuesto aprobado del proyecto como string decimal no negativo.',
  })
  @Transform(({ value }: { value: unknown }) => normalizeMoneyInput(value))
  @IsString()
  @Matches(normalizedDecimalMoneyPattern, {
    message: 'approvedBudget debe ser un decimal no negativo con maximo 2 decimales.',
  })
  approvedBudget!: string;
}
