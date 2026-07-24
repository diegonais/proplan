import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskDependency } from './entities/task-dependency.entity';
import { TaskDependenciesController } from './task-dependencies.controller';
import { TaskDependenciesService } from './task-dependencies.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskDependency, Task, Project, ProjectMember])],
  controllers: [TaskDependenciesController],
  providers: [TaskDependenciesService],
})
export class TaskDependenciesModule {}
