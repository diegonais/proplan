import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ProjectStatus } from '../../../common/enums/project-status.enum';
import { UserRole } from '../../../common/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';
import { Project } from '../entities/project.entity';

export class ProjectManagerResponseDto {
  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Diego Administrador' })
  name!: string;

  @ApiProperty({ example: 'admin@proplan.local' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.PROJECT_MANAGER })
  role!: UserRole;

  static fromEntity(user: User): ProjectManagerResponseDto {
    return {
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}

export class ProjectResponseDto {
  @ApiProperty({ example: '8a1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  uuid!: string;

  @ApiProperty({ example: 'Implementacion ERP interno' })
  name!: string;

  @ApiPropertyOptional({ example: 'Proyecto de centralizacion de procesos administrativos.' })
  description!: string | null;

  @ApiProperty({ example: 'Centralizar la planificacion y seguimiento del proyecto.' })
  objective!: string;

  @ApiProperty({ example: '2026-08-01' })
  startDate!: string;

  @ApiProperty({ example: '2026-12-15' })
  endDate!: string;

  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.PLANNING })
  status!: ProjectStatus;

  @ApiProperty({ example: '15000.00' })
  approvedBudget!: string;

  @ApiProperty({ example: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541' })
  managerUuid!: string;

  @ApiProperty({ type: ProjectManagerResponseDto })
  manager!: ProjectManagerResponseDto;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-24T18:30:00.000Z' })
  updatedAt!: string;

  static fromEntity(project: Project): ProjectResponseDto {
    return {
      uuid: project.uuid,
      name: project.name,
      description: project.description,
      objective: project.objective,
      startDate: project.startDate,
      endDate: project.endDate,
      status: project.status,
      approvedBudget: project.approvedBudget,
      managerUuid: project.managerUuid,
      manager: ProjectManagerResponseDto.fromEntity(project.manager),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
