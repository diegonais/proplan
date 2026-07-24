import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateTaskAssignmentDto {
  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  @IsUUID()
  userUuid!: string;

  @ApiProperty({ example: 16, minimum: 0 })
  @Transform(({ value }: { value: unknown }) => normalizeNumberInput(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  assignedHours!: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMainResponsible?: boolean;
}

function normalizeNumberInput(value: unknown): unknown {
  if (typeof value === 'string') {
    return Number(value);
  }

  return value;
}
