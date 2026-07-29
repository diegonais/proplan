import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';

import { Project } from '../../projects/entities/project.entity';
import { Resource } from '../../resources/entities/resource.entity';
import { Task } from '../../tasks/entities/task.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'resource_assignments' })
@Check('CHK_resource_assignments_date_range', '"endDate" >= "startDate"')
@Index('IDX_resource_assignments_resource_uuid', ['resourceUuid'])
@Index('IDX_resource_assignments_project_uuid', ['projectUuid'])
@Index('IDX_resource_assignments_task_uuid', ['taskUuid'])
@Index('IDX_resource_assignments_assigned_by_uuid', ['assignedByUuid'])
@Index('IDX_resource_assignments_start_date', ['startDate'])
@Index('IDX_resource_assignments_end_date', ['endDate'])
@Exclusion(
  'EX_resource_assignments_no_active_overlap',
  `USING gist ("resourceUuid" WITH =, daterange("startDate", "endDate", '[]') WITH &&) WHERE ("deletedAt" IS NULL)`,
)
export class ResourceAssignment {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_resource_assignments_uuid' })
  uuid!: string;

  @Column({ type: 'uuid' })
  resourceUuid!: string;

  @Column({ type: 'uuid' })
  projectUuid!: string;

  @Column({ type: 'uuid', nullable: true })
  taskUuid!: string | null;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({ type: 'uuid' })
  assignedByUuid!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Resource, (resource) => resource.assignments, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'resourceUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_resource_assignments_resource_uuid_resources_uuid',
  })
  resource!: Relation<Resource>;

  @ManyToOne(() => Project, (project) => project.resourceAssignments, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'projectUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_resource_assignments_project_uuid_projects_uuid',
  })
  project!: Relation<Project>;

  @ManyToOne(() => Task, (task) => task.resourceAssignments, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'taskUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_resource_assignments_task_uuid_tasks_uuid',
  })
  task!: Relation<Task | null>;

  @ManyToOne(() => User, (user) => user.resourceAssignmentsCreated, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'assignedByUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_resource_assignments_assigned_by_uuid_users_uuid',
  })
  assignedBy!: Relation<User>;
}
