import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../common/enums/user-role.enum';

export class WorkloadUserResponseDto {
  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Diego Usuario' })
  name!: string;

  @ApiProperty({ example: 'usuario@proplan.local' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;
}

export class WorkloadItemResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  userUuid!: string;

  @ApiProperty({ type: WorkloadUserResponseDto })
  user!: WorkloadUserResponseDto;

  @ApiProperty({ example: '36.00' })
  assignedHours!: string;
}
