import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ResourceCategory } from '../../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';
import { ResourceAssignment } from '../entities/resource-assignment.entity';
import { ResourceAssignmentTemporalStatus } from './resource-assignment-temporal-status.enum';

class ResourceAssignmentResourceDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Laptop Dell Latitude 5440' })
  name!: string;

  @ApiProperty({ example: 'LAP-LOG-001' })
  code!: string;

  @ApiProperty({ enum: ResourceCategory, example: ResourceCategory.LAPTOP })
  category!: ResourceCategory;

  @ApiProperty({
    enum: ResourceOperationalStatus,
    example: ResourceOperationalStatus.OPERATIONAL,
  })
  operationalStatus!: ResourceOperationalStatus;
}

class ResourceAssignmentProjectDto {
  @ApiProperty({ example: '6a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Implementacion TMS' })
  name!: string;
}

class ResourceAssignmentTaskDto {
  @ApiProperty({ example: '7a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Pruebas de campo' })
  name!: string;
}

class ResourceAssignmentUserDto {
  @ApiProperty({ example: '5a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Ana Perez' })
  name!: string;

  @ApiProperty({ example: 'ana.perez@logistisoft.local' })
  email!: string;
}

export class ResourceAssignmentResponseDto {
  @ApiProperty({ example: '9b1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  resourceUuid!: string;

  @ApiProperty({ example: '6a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiPropertyOptional({ example: '7a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541', nullable: true })
  taskUuid!: string | null;

  @ApiProperty({ example: '2026-08-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  endDate!: string;

  @ApiProperty({ enum: ResourceAssignmentTemporalStatus })
  temporalStatus!: ResourceAssignmentTemporalStatus;

  @ApiProperty({ example: '5a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  assignedByUuid!: string;

  @ApiPropertyOptional({ example: 'Asignado para pruebas de integracion.', nullable: true })
  notes!: string | null;

  @ApiProperty({ type: ResourceAssignmentResourceDto })
  resource!: ResourceAssignmentResourceDto;

  @ApiProperty({ type: ResourceAssignmentProjectDto })
  project!: ResourceAssignmentProjectDto;

  @ApiPropertyOptional({ type: ResourceAssignmentTaskDto, nullable: true })
  task!: ResourceAssignmentTaskDto | null;

  @ApiProperty({ type: ResourceAssignmentUserDto })
  assignedBy!: ResourceAssignmentUserDto;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  updatedAt!: string;

  static fromEntity(
    assignment: ResourceAssignment,
    today: string,
  ): ResourceAssignmentResponseDto {
    return {
      uuid: assignment.uuid,
      resourceUuid: assignment.resourceUuid,
      projectUuid: assignment.projectUuid,
      taskUuid: assignment.taskUuid,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      temporalStatus: calculateTemporalStatus(assignment.startDate, assignment.endDate, today),
      assignedByUuid: assignment.assignedByUuid,
      notes: assignment.notes,
      resource: {
        uuid: assignment.resource.uuid,
        name: assignment.resource.name,
        code: assignment.resource.code,
        category: assignment.resource.category,
        operationalStatus: assignment.resource.operationalStatus,
      },
      project: {
        uuid: assignment.project.uuid,
        name: assignment.project.name,
      },
      task:
        assignment.task === null
          ? null
          : {
              uuid: assignment.task.uuid,
              name: assignment.task.name,
            },
      assignedBy: {
        uuid: assignment.assignedBy.uuid,
        name: assignment.assignedBy.name,
        email: assignment.assignedBy.email,
      },
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    };
  }
}

export function calculateTemporalStatus(
  startDate: string,
  endDate: string,
  today: string,
): ResourceAssignmentTemporalStatus {
  if (endDate < today) {
    return ResourceAssignmentTemporalStatus.FINISHED;
  }

  if (startDate > today) {
    return ResourceAssignmentTemporalStatus.SCHEDULED;
  }

  return ResourceAssignmentTemporalStatus.ACTIVE;
}
