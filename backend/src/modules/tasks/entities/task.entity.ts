import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';

import { TaskStatus } from '../../../common/enums/task-status.enum';
import { Project } from '../../projects/entities/project.entity';
import { ResourceAssignment } from '../../resource-assignments/entities/resource-assignment.entity';
import { TaskAssignment } from '../../task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../../task-dependencies/entities/task-dependency.entity';

@Entity({ name: 'tasks' })
@Check('CHK_tasks_date_range', '"endDate" >= "startDate"')
@Check('CHK_tasks_progress_range', '"progress" >= 0 AND "progress" <= 100')
@Check('CHK_tasks_estimated_hours_non_negative', '"estimatedHours" >= 0')
@Check('CHK_tasks_planned_budget_non_negative', '"plannedBudget" >= 0')
@Check('CHK_tasks_actual_cost_non_negative', '"actualCost" >= 0')
@Check('CHK_tasks_actual_cost_within_planned_budget', '"actualCost" <= "plannedBudget"')
@Check('CHK_tasks_completed_progress', '"status" <> \'COMPLETED\' OR "progress" = 100')
@Index('IDX_tasks_project_uuid', ['projectUuid'])
@Index('IDX_tasks_parent_task_uuid', ['parentTaskUuid'])
@Index('IDX_tasks_status', ['status'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({ type: 'uuid' })
  projectUuid!: string;

  @Column({ type: 'uuid', nullable: true })
  parentTaskUuid!: string | null;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status',
    default: TaskStatus.PENDING,
  })
  status!: TaskStatus;

  @Column({ type: 'smallint', default: 0 })
  progress!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  estimatedHours!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  plannedBudget!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  actualCost!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Project, (project) => project.tasks, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'projectUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_tasks_project_uuid_projects_uuid',
  })
  project!: Relation<Project>;

  @ManyToOne(() => Task, (task) => task.subtasks, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'parentTaskUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_tasks_parent_task_uuid_tasks_uuid',
  })
  parentTask!: Relation<Task | null>;

  @OneToMany(() => Task, (task) => task.parentTask)
  subtasks!: Relation<Task[]>;

  @OneToMany(() => TaskAssignment, (taskAssignment) => taskAssignment.task)
  assignments!: Relation<TaskAssignment[]>;

  @OneToMany(() => TaskDependency, (taskDependency) => taskDependency.predecessorTask)
  outgoingDependencies!: Relation<TaskDependency[]>;

  @OneToMany(() => TaskDependency, (taskDependency) => taskDependency.successorTask)
  incomingDependencies!: Relation<TaskDependency[]>;

  @OneToMany(() => ResourceAssignment, (resourceAssignment) => resourceAssignment.task)
  resourceAssignments!: Relation<ResourceAssignment[]>;
}
