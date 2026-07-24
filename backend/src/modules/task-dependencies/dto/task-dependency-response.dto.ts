import { ApiProperty } from '@nestjs/swagger';

import { TaskDependencyType } from '../../../common/enums/task-dependency-type.enum';
import { TaskResponseDto } from '../../tasks/dto/task-response.dto';
import { TaskDependency } from '../entities/task-dependency.entity';

export class TaskDependencyResponseDto {
  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  uuid!: string;

  @ApiProperty({ example: '1bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  predecessorTaskUuid!: string;

  @ApiProperty({ example: '2bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  successorTaskUuid!: string;

  @ApiProperty({ enum: TaskDependencyType, example: TaskDependencyType.FINISH_TO_START })
  dependencyType!: TaskDependencyType;

  @ApiProperty({ type: TaskResponseDto })
  predecessorTask!: TaskResponseDto;

  @ApiProperty({ type: TaskResponseDto })
  successorTask!: TaskResponseDto;

  static fromEntity(taskDependency: TaskDependency): TaskDependencyResponseDto {
    return {
      uuid: taskDependency.uuid,
      predecessorTaskUuid: taskDependency.predecessorTaskUuid,
      successorTaskUuid: taskDependency.successorTaskUuid,
      dependencyType: taskDependency.dependencyType,
      predecessorTask: TaskResponseDto.fromEntity(taskDependency.predecessorTask),
      successorTask: TaskResponseDto.fromEntity(taskDependency.successorTask),
    };
  }
}

export class TaskDependenciesResponseDto {
  @ApiProperty({ type: [TaskDependencyResponseDto] })
  incoming!: TaskDependencyResponseDto[];

  @ApiProperty({ type: [TaskDependencyResponseDto] })
  outgoing!: TaskDependencyResponseDto[];
}
