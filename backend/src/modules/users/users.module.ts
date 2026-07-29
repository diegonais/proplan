import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Project, ProjectMember, TaskAssignment])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
