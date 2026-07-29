import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

import { UserRole } from '../../../common/enums/user-role.enum';
import { ProjectMember } from '../../project-members/entities/project-member.entity';
import { Project } from '../../projects/entities/project.entity';
import { ResourceAssignment } from '../../resource-assignments/entities/resource-assignment.entity';
import { TaskAssignment } from '../../task-assignments/entities/task-assignment.entity';

const emailNormalizer: ValueTransformer = {
  to: (value: string): string => value.trim().toLowerCase(),
  from: (value: string): string => value,
};

@Entity({ name: 'users' })
@Check('CHK_users_email_normalized', 'email = lower(email)')
@Index('UQ_users_email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 180, transformer: emailNormalizer })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
  })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Project, (project) => project.manager)
  managedProjects!: Relation<Project[]>;

  @OneToMany(() => ProjectMember, (projectMember) => projectMember.user)
  projectMemberships!: Relation<ProjectMember[]>;

  @OneToMany(() => TaskAssignment, (taskAssignment) => taskAssignment.user)
  taskAssignments!: Relation<TaskAssignment[]>;

  @OneToMany(() => ResourceAssignment, (resourceAssignment) => resourceAssignment.assignedBy)
  resourceAssignmentsCreated!: Relation<ResourceAssignment[]>;
}
