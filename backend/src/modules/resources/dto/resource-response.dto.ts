import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ResourceCategory } from '../../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';
import { Resource } from '../entities/resource.entity';

export class ResourceResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Laptop Dell Latitude 5440' })
  name!: string;

  @ApiPropertyOptional({ example: 'Equipo para pruebas de campo.', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'LAP-LOG-001' })
  code!: string;

  @ApiProperty({ enum: ResourceCategory, example: ResourceCategory.LAPTOP })
  category!: ResourceCategory;

  @ApiPropertyOptional({ example: 'SN-2026-0001', nullable: true })
  serialNumber!: string | null;

  @ApiProperty({
    enum: ResourceOperationalStatus,
    example: ResourceOperationalStatus.OPERATIONAL,
  })
  operationalStatus!: ResourceOperationalStatus;

  @ApiPropertyOptional({ example: 'Garantia vigente hasta diciembre.', nullable: true })
  notes!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  updatedAt!: string;

  static fromEntity(resource: Resource): ResourceResponseDto {
    return {
      uuid: resource.uuid,
      name: resource.name,
      description: resource.description,
      code: resource.code,
      category: resource.category,
      serialNumber: resource.serialNumber,
      operationalStatus: resource.operationalStatus,
      notes: resource.notes,
      isActive: resource.isActive,
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    };
  }
}
