import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../common/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';

export class ProjectMemberCandidateResponseDto {
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

  static fromEntity(user: User): ProjectMemberCandidateResponseDto {
    return {
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
