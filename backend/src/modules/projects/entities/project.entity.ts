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

import { ProjectStatus } from '../../../common/enums/project-status.enum';
import { ProjectMember } from '../../project-members/entities/project-member.entity';
import { ResourceAssignment } from '../../resource-assignments/entities/resource-assignment.entity';
import { Task } from '../../tasks/entities/task.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'projects' })
@Check('CHK_projects_date_range', '"endDate" >= "startDate"')
@Check('CHK_projects_approved_budget_non_negative', '"approvedBudget" >= 0')
@Index('IDX_projects_manager_uuid', ['managerUuid'])
@Index('IDX_projects_status', ['status'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text' })
  objective!: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    enumName: 'project_status',
    default: ProjectStatus.PLANNING,
  })
  status!: ProjectStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  approvedBudget!: string;

  @Column({ type: 'uuid' })
  managerUuid!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => User, (user) => user.managedProjects, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'managerUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_projects_manager_uuid_users_uuid',
  })
  manager!: Relation<User>;

  @OneToMany(() => ProjectMember, (projectMember) => projectMember.project)
  members!: Relation<ProjectMember[]>;

  @OneToMany(() => Task, (task) => task.project)
  tasks!: Relation<Task[]>;

  @OneToMany(() => ResourceAssignment, (resourceAssignment) => resourceAssignment.project)
  resourceAssignments!: Relation<ResourceAssignment[]>;
}
