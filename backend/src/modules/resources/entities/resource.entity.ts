import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';

import { ResourceCategory } from '../../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../../common/enums/resource-operational-status.enum';
import { ResourceAssignment } from '../../resource-assignments/entities/resource-assignment.entity';

@Entity({ name: 'resources' })
@Index('UQ_resources_code', ['code'], { unique: true })
@Index('IDX_resources_category', ['category'])
@Index('IDX_resources_operational_status', ['operationalStatus'])
@Index('IDX_resources_is_active', ['isActive'])
@Index('IDX_resources_deleted_at', ['deletedAt'])
export class Resource {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_resources_uuid' })
  uuid!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 80 })
  code!: string;

  @Column({
    type: 'enum',
    enum: ResourceCategory,
    enumName: 'resource_category',
  })
  category!: ResourceCategory;

  @Column({ type: 'varchar', length: 120, nullable: true })
  serialNumber!: string | null;

  @Column({
    type: 'enum',
    enum: ResourceOperationalStatus,
    enumName: 'resource_operational_status',
    default: ResourceOperationalStatus.OPERATIONAL,
  })
  operationalStatus!: ResourceOperationalStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => ResourceAssignment, (resourceAssignment) => resourceAssignment.resource)
  assignments!: Relation<ResourceAssignment[]>;
}
