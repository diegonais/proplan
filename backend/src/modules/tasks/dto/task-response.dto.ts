import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TaskStatus } from '../../../common/enums/task-status.enum';
import { Task } from '../entities/task.entity';

export class TaskMainResponsibleResponseDto {
  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Diego Usuario' })
  name!: string;

  @ApiProperty({ example: 'usuario@proplan.local' })
  email!: string;
}

export class TaskResponseDto {
  @ApiProperty({ example: '0bdcfd5c-2ac3-43da-9bb6-28e8e8126eb1' })
  uuid!: string;

  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  projectUuid!: string;

  @ApiPropertyOptional({ example: '9a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  parentTaskUuid!: string | null;

  @ApiProperty({ example: 'Levantamiento de requerimientos' })
  name!: string;

  @ApiPropertyOptional({ example: 'Reunion con usuarios clave.' })
  description!: string | null;

  @ApiProperty({ example: '2026-08-05' })
  startDate!: string;

  @ApiProperty({ example: '2026-08-12' })
  endDate!: string;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.PENDING })
  status!: TaskStatus;

  @ApiProperty({ example: 0 })
  progress!: number;

  @ApiProperty({ example: '24.00' })
  estimatedHours!: string;

  @ApiPropertyOptional({
    type: TaskMainResponsibleResponseDto,
    nullable: true,
    description: 'Responsable principal de la actividad cuando existe una asignacion marcada como principal.',
  })
  mainResponsible!: TaskMainResponsibleResponseDto | null;

  @ApiProperty({
    example: '1500.00',
    nullable: true,
    description:
      'String decimal cuando el usuario puede ver informacion financiera; null para roles no autorizados.',
  })
  plannedBudget!: string | null;

  @ApiProperty({
    example: '0.00',
    nullable: true,
    description:
      'String decimal cuando el usuario puede ver informacion financiera; null para roles no autorizados.',
  })
  actualCost!: string | null;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  updatedAt!: string;

  static fromEntity(task: Task, includeFinancials = true): TaskResponseDto {
    const assignments = Array.isArray(task.assignments) ? task.assignments : [];
    const mainResponsible = assignments.find((assignment) => assignment.isMainResponsible);

    return {
      uuid: task.uuid,
      projectUuid: task.projectUuid,
      parentTaskUuid: task.parentTaskUuid,
      name: task.name,
      description: task.description,
      startDate: task.startDate,
      endDate: task.endDate,
      status: task.status,
      progress: task.progress,
      estimatedHours: task.estimatedHours,
      mainResponsible:
        mainResponsible === undefined
          ? null
          : {
              uuid: mainResponsible.user.uuid,
              name: mainResponsible.user.name,
              email: mainResponsible.user.email,
            },
      plannedBudget: includeFinancials ? task.plannedBudget : null,
      actualCost: includeFinancials ? task.actualCost : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
