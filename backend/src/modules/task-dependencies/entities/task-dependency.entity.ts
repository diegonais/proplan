import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from 'typeorm';

import { TaskDependencyType } from '../../../common/enums/task-dependency-type.enum';
import { Task } from '../../tasks/entities/task.entity';

@Entity({ name: 'task_dependencies' })
@Check('CHK_task_dependencies_not_self_dependency', '"predecessorTaskUuid" <> "successorTaskUuid"')
@Unique('UQ_task_dependencies_predecessor_successor_type', [
  'predecessorTaskUuid',
  'successorTaskUuid',
  'dependencyType',
])
@Index('IDX_task_dependencies_predecessor_task_uuid', ['predecessorTaskUuid'])
@Index('IDX_task_dependencies_successor_task_uuid', ['successorTaskUuid'])
export class TaskDependency {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({ type: 'uuid' })
  predecessorTaskUuid!: string;

  @Column({ type: 'uuid' })
  successorTaskUuid!: string;

  @Column({
    type: 'enum',
    enum: TaskDependencyType,
    enumName: 'task_dependency_type',
    default: TaskDependencyType.FINISH_TO_START,
  })
  dependencyType!: TaskDependencyType;

  @ManyToOne(() => Task, (task) => task.outgoingDependencies, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'predecessorTaskUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_task_dependencies_predecessor_task_uuid_tasks_uuid',
  })
  predecessorTask!: Relation<Task>;

  @ManyToOne(() => Task, (task) => task.incomingDependencies, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'successorTaskUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_task_dependencies_successor_task_uuid_tasks_uuid',
  })
  successorTask!: Relation<Task>;
}
