import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from '../projects/entities/project.entity';
import { Resource } from '../resources/entities/resource.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { ResourceAssignment } from './entities/resource-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ResourceAssignment, Resource, Project, Task, User])],
})
export class ResourceAssignmentsModule {}
