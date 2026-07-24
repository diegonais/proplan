import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTaskAssignmentDto {
  @ApiPropertyOptional({ example: 20, minimum: 0 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeNumberInput(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  assignedHours?: number;
}

function normalizeNumberInput(value: unknown): unknown {
  if (typeof value === 'string') {
    return Number(value);
  }

  return value;
}
