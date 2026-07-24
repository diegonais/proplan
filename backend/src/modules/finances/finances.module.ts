import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from '../projects/entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Task])],
  controllers: [FinancesController],
  providers: [FinancesService],
})
export class FinancesModule {}
