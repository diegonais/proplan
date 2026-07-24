import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { UserRole } from '../../../common/enums/user-role.enum';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.PROJECT_MANAGER })
  @IsEnum(UserRole)
  role!: UserRole;
}
