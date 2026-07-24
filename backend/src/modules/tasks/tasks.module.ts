import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { TaskDependency } from '../task-dependencies/entities/task-dependency.entity';
import { Task } from './entities/task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Project, ProjectMember, TaskDependency])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
