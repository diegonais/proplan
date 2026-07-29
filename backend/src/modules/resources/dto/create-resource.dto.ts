import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ResourceCategory } from '../../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';

const normalizeOptionalText = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
};

export class CreateResourceDto {
  @ApiProperty({ example: 'Laptop Dell Latitude 5440', maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({ example: 'Equipo para pruebas de campo.', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(normalizeOptionalText)
  description?: string | null;

  @ApiProperty({ example: 'LAP-LOG-001', maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @ApiProperty({ enum: ResourceCategory, example: ResourceCategory.LAPTOP })
  @IsEnum(ResourceCategory)
  category!: ResourceCategory;

  @ApiPropertyOptional({ example: 'SN-2026-0001', maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(normalizeOptionalText)
  serialNumber?: string | null;

  @ApiPropertyOptional({
    enum: ResourceOperationalStatus,
    example: ResourceOperationalStatus.OPERATIONAL,
    default: ResourceOperationalStatus.OPERATIONAL,
  })
  @IsOptional()
  @IsEnum(ResourceOperationalStatus)
  operationalStatus?: ResourceOperationalStatus;

  @ApiPropertyOptional({ example: 'Garantia vigente hasta diciembre.', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(normalizeOptionalText)
  notes?: string | null;
}
