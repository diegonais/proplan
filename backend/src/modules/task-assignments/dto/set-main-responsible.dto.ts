import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SetMainResponsibleDto {
  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  @IsUUID()
  userUuid!: string;
}
