import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../common/enums/user-role.enum';
import { User } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Diego Administrador' })
  name!: string;

  @ApiProperty({ example: 'admin@proplan.local' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  role!: UserRole;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  updatedAt!: string;

  static fromEntity(user: User): UserResponseDto {
    return {
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
