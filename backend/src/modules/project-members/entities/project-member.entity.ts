import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
  Column,
} from 'typeorm';

import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'project_members' })
@Unique('UQ_project_members_project_uuid_user_uuid', ['projectUuid', 'userUuid'])
@Index('IDX_project_members_project_uuid', ['projectUuid'])
@Index('IDX_project_members_user_uuid', ['userUuid'])
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  uuid!: string;

  @Column({ type: 'uuid' })
  projectUuid!: string;

  @Column({ type: 'uuid' })
  userUuid!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;

  @ManyToOne(() => Project, (project) => project.members, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'projectUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_project_members_project_uuid_projects_uuid',
  })
  project!: Relation<Project>;

  @ManyToOne(() => User, (user) => user.projectMemberships, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'userUuid',
    referencedColumnName: 'uuid',
    foreignKeyConstraintName: 'FK_project_members_user_uuid_users_uuid',
  })
  user!: Relation<User>;
}
