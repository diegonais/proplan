import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';
import { ResourceAssignment } from '../../resource-assignments/entities/resource-assignment.entity';

export enum ResourceUnavailableReason {
  RESOURCE_DELETED = 'RESOURCE_DELETED',
  RESOURCE_INACTIVE = 'RESOURCE_INACTIVE',
  NON_OPERATIONAL_STATUS = 'NON_OPERATIONAL_STATUS',
  ASSIGNMENT_CONFLICT = 'ASSIGNMENT_CONFLICT',
}

export class ResourceAvailabilityConflictDto {
  @ApiProperty({ example: '9b1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiPropertyOptional({ example: '7a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541', nullable: true })
  taskUuid!: string | null;

  @ApiProperty({ example: '2026-08-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  endDate!: string;

  static fromEntity(assignment: ResourceAssignment): ResourceAvailabilityConflictDto {
    return {
      uuid: assignment.uuid,
      projectUuid: assignment.projectUuid,
      taskUuid: assignment.taskUuid,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
    };
  }
}

export class ResourceAvailabilityResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  resourceUuid!: string;

  @ApiProperty({ example: false })
  available!: boolean;

  @ApiProperty({
    enum: ResourceOperationalStatus,
    example: ResourceOperationalStatus.OPERATIONAL,
  })
  operationalStatus!: ResourceOperationalStatus;

  @ApiPropertyOptional({
    enum: ResourceUnavailableReason,
    example: ResourceUnavailableReason.ASSIGNMENT_CONFLICT,
    nullable: true,
  })
  unavailableReason!: ResourceUnavailableReason | null;

  @ApiProperty({ type: [ResourceAvailabilityConflictDto] })
  conflicts!: ResourceAvailabilityConflictDto[];
}
