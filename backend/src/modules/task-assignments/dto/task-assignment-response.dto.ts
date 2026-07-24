import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../common/enums/user-role.enum';
import { TaskAssignment } from '../entities/task-assignment.entity';

export class TaskAssignmentUserResponseDto {
  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Diego Usuario' })
  name!: string;

  @ApiProperty({ example: 'usuario@proplan.local' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class TaskAssignmentResponseDto {
  @ApiProperty({ example: 'd2a8f7a9-c742-4e0b-a51e-022a1476c8be' })
  uuid!: string;

  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  taskUuid!: string;

  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  userUuid!: string;

  @ApiProperty({ example: '16.00' })
  assignedHours!: string;

  @ApiProperty({ example: false })
  isMainResponsible!: boolean;

  @ApiProperty({ type: TaskAssignmentUserResponseDto })
  user!: TaskAssignmentUserResponseDto;

  static fromEntity(assignment: TaskAssignment): TaskAssignmentResponseDto {
    return {
      uuid: assignment.uuid,
      taskUuid: assignment.taskUuid,
      userUuid: assignment.userUuid,
      assignedHours: assignment.assignedHours,
      isMainResponsible: assignment.isMainResponsible,
      user: {
        uuid: assignment.user.uuid,
        name: assignment.user.name,
        email: assignment.user.email,
        role: assignment.user.role,
        isActive: assignment.user.isActive,
      },
    };
  }
}
