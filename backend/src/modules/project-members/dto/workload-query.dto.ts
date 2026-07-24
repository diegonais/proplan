import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class WorkloadQueryDto {
  @ApiPropertyOptional({
    example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541',
    description: 'Filtra la carga de trabajo por usuario dentro del proyecto autorizado.',
  })
  @IsOptional()
  @IsUUID()
  userUuid?: string;
}
