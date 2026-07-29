import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ResourceAssignment } from '../resource-assignments/entities/resource-assignment.entity';
import { Resource } from './entities/resource.entity';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  imports: [TypeOrmModule.forFeature([Resource, ResourceAssignment])],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
