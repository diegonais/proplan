import { ApiProperty } from '@nestjs/swagger';

import { ProjectResponseDto } from './project-response.dto';

class ProjectsPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PaginatedProjectsResponseDto {
  @ApiProperty({ type: [ProjectResponseDto] })
  data!: ProjectResponseDto[];

  @ApiProperty({ type: ProjectsPaginationMetaDto })
  meta!: ProjectsPaginationMetaDto;
}
