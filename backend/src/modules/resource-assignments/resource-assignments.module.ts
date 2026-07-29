import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from '../projects/entities/project.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Resource } from '../resources/entities/resource.entity';
import { Task } from '../tasks/entities/task.entity';
import { ResourceAssignment } from './entities/resource-assignment.entity';
import { ResourceAssignmentsController } from './resource-assignments.controller';
import { ResourceAssignmentsService } from './resource-assignments.service';

@Module({
  imports: [TypeOrmModule.forFeature([ResourceAssignment, Resource, Project, Task, ProjectMember])],
  controllers: [ResourceAssignmentsController],
  providers: [ResourceAssignmentsService],
})
export class ResourceAssignmentsModule {}
