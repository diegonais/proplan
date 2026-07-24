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

import { Task } from '../../tasks/entities/task.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'task_assignments' })
@Check('CHK_task_assignments_assigned_hours_non_negative', '"assignedHours" >= 0')
@Unique('UQ_task_assignments_task_uuid_user_uuid', ['taskUuid', 'userUuid'])
@Index('IDX_task_assignments_task_uuid', ['taskUuid'])
@Index('IDX_task_assignments_user_uuid', ['userUuid'])
@Index('UQ_task_assignments_one_main_responsible_per_task', ['taskUuid'], {
  unique: true,
  where: '"isMainResponsible" = true',
})
export class TaskAssignment {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({ type: 'uuid' })
  taskUuid!: string;

  @Column({ type: 'uuid' })
  userUuid!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  assignedHours!: string;

  @Column({ type: 'boolean', default: false })
  isMainResponsible!: boolean;

  @ManyToOne(() => Task, (task) => task.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'taskUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_task_assignments_task_uuid_tasks_uuid',
  })
  task!: Relation<Task>;

  @ManyToOne(() => User, (user) => user.taskAssignments, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'userUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_task_assignments_user_uuid_users_uuid',
  })
  user!: Relation<User>;
}
