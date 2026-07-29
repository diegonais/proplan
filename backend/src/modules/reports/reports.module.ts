import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { ResourceAssignment } from '../resource-assignments/entities/resource-assignment.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../task-dependencies/entities/task-dependency.entity';
import { Task } from '../tasks/entities/task.entity';
import { ExportsService } from './exports.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Task,
      TaskDependency,
      TaskAssignment,
      ProjectMember,
      ResourceAssignment,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ExportsService],
})
export class ReportsModule {}
