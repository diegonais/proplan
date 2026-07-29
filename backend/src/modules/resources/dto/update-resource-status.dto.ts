import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';

export class UpdateResourceStatusDto {
  @ApiPropertyOptional({
    enum: ResourceOperationalStatus,
    example: ResourceOperationalStatus.MAINTENANCE,
  })
  @IsOptional()
  @IsEnum(ResourceOperationalStatus)
  operationalStatus?: ResourceOperationalStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
