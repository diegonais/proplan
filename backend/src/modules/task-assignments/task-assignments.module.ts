import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { TaskAssignment } from './entities/task-assignment.entity';
import { TaskAssignmentsController } from './task-assignments.controller';
import { TaskAssignmentsService } from './task-assignments.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskAssignment, Task, Project, ProjectMember, User])],
  controllers: [TaskAssignmentsController],
  providers: [TaskAssignmentsService],
})
export class TaskAssignmentsModule {}
