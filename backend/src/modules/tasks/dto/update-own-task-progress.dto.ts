import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

import { TaskStatus } from '../../../common/enums/task-status.enum';

export class UpdateOwnTaskProgressDto {
  @ApiProperty({ enum: TaskStatus, example: TaskStatus.IN_PROGRESS })
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @ApiProperty({ example: 60, minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  @Max(100)
  progress!: number;
}
