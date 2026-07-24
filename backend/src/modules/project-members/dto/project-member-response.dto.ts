import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../common/enums/user-role.enum';
import { ProjectMember } from '../entities/project-member.entity';

export class ProjectMemberUserResponseDto {
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

export class ProjectMemberResponseDto {
  @ApiProperty({ example: 'f8d7d64d-b8da-49d7-9624-92fe84de05f1' })
  uuid!: string;

  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  userUuid!: string;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  joinedAt!: string;

  @ApiProperty({ type: ProjectMemberUserResponseDto })
  user!: ProjectMemberUserResponseDto;

  @ApiProperty({ example: '36.00' })
  assignedHours!: string;

  static fromEntity(member: ProjectMember, assignedHours = '0.00'): ProjectMemberResponseDto {
    return {
      uuid: member.uuid,
      projectUuid: member.projectUuid,
      userUuid: member.userUuid,
      joinedAt: member.joinedAt.toISOString(),
      user: {
        uuid: member.user.uuid,
        name: member.user.name,
        email: member.user.email,
        role: member.user.role,
        isActive: member.user.isActive,
      },
      assignedHours,
    };
  }
}
