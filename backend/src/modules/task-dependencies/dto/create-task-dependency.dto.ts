import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { TaskDependencyType } from '../../../common/enums/task-dependency-type.enum';

export class CreateTaskDependencyDto {
  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  @IsUUID()
  predecessorTaskUuid!: string;

  @ApiPropertyOptional({
    enum: TaskDependencyType,
    default: TaskDependencyType.FINISH_TO_START,
    description: 'La version inicial solo permite dependencia fin a inicio.',
  })
  @IsOptional()
  @IsEnum(TaskDependencyType)
  dependencyType?: TaskDependencyType;
}
