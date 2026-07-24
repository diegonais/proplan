import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialDataModel1784919396148 implements MigrationInterface {
  name = 'InitialDataModel1784919396148';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "task_assignments" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskUuid" uuid NOT NULL, "userUuid" uuid NOT NULL, "assignedHours" numeric(10,2) NOT NULL DEFAULT '0', "isMainResponsible" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_task_assignments_task_uuid_user_uuid" UNIQUE ("taskUuid", "userUuid"), CONSTRAINT "CHK_task_assignments_assigned_hours_non_negative" CHECK ("assignedHours" >= 0), CONSTRAINT "PK_8af03a5b221232f195095444da9" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_assignments_one_main_responsible_per_task" ON "task_assignments" ("taskUuid") WHERE "isMainResponsible" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_assignments_user_uuid" ON "task_assignments" ("userUuid") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_assignments_task_uuid" ON "task_assignments" ("taskUuid") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_dependency_type" AS ENUM('FINISH_TO_START')`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_dependencies" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "predecessorTaskUuid" uuid NOT NULL, "successorTaskUuid" uuid NOT NULL, "dependencyType" "public"."task_dependency_type" NOT NULL DEFAULT 'FINISH_TO_START', CONSTRAINT "UQ_task_dependencies_predecessor_successor_type" UNIQUE ("predecessorTaskUuid", "successorTaskUuid", "dependencyType"), CONSTRAINT "CHK_task_dependencies_not_self_dependency" CHECK ("predecessorTaskUuid" <> "successorTaskUuid"), CONSTRAINT "PK_d450e4de7c8f42e1b8b7afeeef2" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_dependencies_successor_task_uuid" ON "task_dependencies" ("successorTaskUuid") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_dependencies_predecessor_task_uuid" ON "task_dependencies" ("predecessorTaskUuid") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_status" AS ENUM('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectUuid" uuid NOT NULL, "parentTaskUuid" uuid, "name" character varying(180) NOT NULL, "description" text, "startDate" date NOT NULL, "endDate" date NOT NULL, "status" "public"."task_status" NOT NULL DEFAULT 'PENDING', "progress" smallint NOT NULL DEFAULT '0', "estimatedHours" numeric(10,2) NOT NULL DEFAULT '0', "plannedBudget" numeric(12,2) NOT NULL DEFAULT '0', "actualCost" numeric(12,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_tasks_completed_progress" CHECK ("status" <> 'COMPLETED' OR "progress" = 100), CONSTRAINT "CHK_tasks_actual_cost_non_negative" CHECK ("actualCost" >= 0), CONSTRAINT "CHK_tasks_planned_budget_non_negative" CHECK ("plannedBudget" >= 0), CONSTRAINT "CHK_tasks_estimated_hours_non_negative" CHECK ("estimatedHours" >= 0), CONSTRAINT "CHK_tasks_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100), CONSTRAINT "CHK_tasks_date_range" CHECK ("endDate" >= "startDate"), CONSTRAINT "PK_90915808c3fe8ee2e2d67d8b787" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_tasks_status" ON "tasks" ("status") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_parent_task_uuid" ON "tasks" ("parentTaskUuid") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_tasks_project_uuid" ON "tasks" ("projectUuid") `);
    await queryRunner.query(
      `CREATE TYPE "public"."project_status" AS ENUM('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "description" text, "objective" text NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "status" "public"."project_status" NOT NULL DEFAULT 'PLANNING', "approvedBudget" numeric(12,2) NOT NULL DEFAULT '0', "managerUuid" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_projects_approved_budget_non_negative" CHECK ("approvedBudget" >= 0), CONSTRAINT "CHK_projects_date_range" CHECK ("endDate" >= "startDate"), CONSTRAINT "PK_fc9f1e64d4626f18beff534a9f3" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_projects_status" ON "projects" ("status") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_manager_uuid" ON "projects" ("managerUuid") `,
    );
    await queryRunner.query(
      `CREATE TABLE "project_members" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectUuid" uuid NOT NULL, "userUuid" uuid NOT NULL, "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_project_members_project_uuid_user_uuid" UNIQUE ("projectUuid", "userUuid"), CONSTRAINT "PK_c8b6c14ef603a63adee3c681e57" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_user_uuid" ON "project_members" ("userUuid") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_project_uuid" ON "project_members" ("projectUuid") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'PROJECT_MANAGER', 'USER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(180) NOT NULL, "passwordHash" character varying(255) NOT NULL, "role" "public"."user_role" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_users_email_normalized" CHECK (email = lower(email)), CONSTRAINT "PK_951b8f1dfc94ac1d0301a14b7e1" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email") `);
    await queryRunner.query(
      `ALTER TABLE "task_assignments" ADD CONSTRAINT "FK_task_assignments_task_uuid_tasks_uuid" FOREIGN KEY ("taskUuid") REFERENCES "tasks"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_assignments" ADD CONSTRAINT "FK_task_assignments_user_uuid_users_uuid" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_predecessor_task_uuid_tasks_uuid" FOREIGN KEY ("predecessorTaskUuid") REFERENCES "tasks"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_successor_task_uuid_tasks_uuid" FOREIGN KEY ("successorTaskUuid") REFERENCES "tasks"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_project_uuid_projects_uuid" FOREIGN KEY ("projectUuid") REFERENCES "projects"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_parent_task_uuid_tasks_uuid" FOREIGN KEY ("parentTaskUuid") REFERENCES "tasks"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_manager_uuid_users_uuid" FOREIGN KEY ("managerUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_project_uuid_projects_uuid" FOREIGN KEY ("projectUuid") REFERENCES "projects"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_members_user_uuid_users_uuid" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_user_uuid_users_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_members_project_uuid_projects_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_manager_uuid_users_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_parent_task_uuid_tasks_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_project_uuid_projects_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_task_dependencies_successor_task_uuid_tasks_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_task_dependencies_predecessor_task_uuid_tasks_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_assignments" DROP CONSTRAINT "FK_task_assignments_user_uuid_users_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_assignments" DROP CONSTRAINT "FK_task_assignments_task_uuid_tasks_uuid"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_project_members_project_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_project_members_user_uuid"`);
    await queryRunner.query(`DROP TABLE "project_members"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_manager_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_status"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "public"."project_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_project_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_parent_task_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_status"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TYPE "public"."task_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_task_dependencies_predecessor_task_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_task_dependencies_successor_task_uuid"`);
    await queryRunner.query(`DROP TABLE "task_dependencies"`);
    await queryRunner.query(`DROP TYPE "public"."task_dependency_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_task_assignments_task_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_task_assignments_user_uuid"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_task_assignments_one_main_responsible_per_task"`,
    );
    await queryRunner.query(`DROP TABLE "task_assignments"`);
  }
}
