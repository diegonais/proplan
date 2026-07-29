import { ApiProperty } from '@nestjs/swagger';

import { ResourceResponseDto } from './resource-response.dto';

class ResourcesPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PaginatedResourcesResponseDto {
  @ApiProperty({ type: [ResourceResponseDto] })
  data!: ResourceResponseDto[];

  @ApiProperty({ type: ResourcesPaginationMetaDto })
  meta!: ResourcesPaginationMetaDto;
}
