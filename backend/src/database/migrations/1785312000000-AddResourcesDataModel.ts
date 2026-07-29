import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourcesDataModel1785312000000 implements MigrationInterface {
  name = 'AddResourcesDataModel1785312000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);
    await queryRunner.query(
      `CREATE TYPE "public"."resource_category" AS ENUM('DESKTOP_COMPUTER', 'LAPTOP', 'SERVER', 'MOBILE_DEVICE', 'TABLET', 'PERIPHERAL', 'NETWORK_EQUIPMENT', 'SOFTWARE_LICENSE', 'CLOUD_SERVICE', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."resource_operational_status" AS ENUM('OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "resources" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "description" text, "code" character varying(80) NOT NULL, "category" "public"."resource_category" NOT NULL, "serialNumber" character varying(120), "operationalStatus" "public"."resource_operational_status" NOT NULL DEFAULT 'OPERATIONAL', "notes" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_resources_uuid" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_resources_code" ON "resources" ("code")`);
    await queryRunner.query(`CREATE INDEX "IDX_resources_deleted_at" ON "resources" ("deletedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_resources_is_active" ON "resources" ("isActive")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_resources_operational_status" ON "resources" ("operationalStatus")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_resources_category" ON "resources" ("category")`);
    await queryRunner.query(
      `CREATE TABLE "resource_assignments" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "resourceUuid" uuid NOT NULL, "projectUuid" uuid NOT NULL, "taskUuid" uuid, "startDate" date NOT NULL, "endDate" date NOT NULL, "assignedByUuid" uuid NOT NULL, "notes" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_resource_assignments_date_range" CHECK ("endDate" >= "startDate"), CONSTRAINT "PK_resource_assignments_uuid" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resource_assignments_end_date" ON "resource_assignments" ("endDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resource_assignments_start_date" ON "resource_assignments" ("startDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resource_assignments_assigned_by_uuid" ON "resource_assignments" ("assignedByUuid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resource_assignments_task_uuid" ON "resource_assignments" ("taskUuid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resource_assignments_project_uuid" ON "resource_assignments" ("projectUuid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resource_assignments_resource_uuid" ON "resource_assignments" ("resourceUuid")`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" ADD CONSTRAINT "FK_resource_assignments_resource_uuid_resources_uuid" FOREIGN KEY ("resourceUuid") REFERENCES "resources"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" ADD CONSTRAINT "FK_resource_assignments_project_uuid_projects_uuid" FOREIGN KEY ("projectUuid") REFERENCES "projects"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" ADD CONSTRAINT "FK_resource_assignments_task_uuid_tasks_uuid" FOREIGN KEY ("taskUuid") REFERENCES "tasks"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" ADD CONSTRAINT "FK_resource_assignments_assigned_by_uuid_users_uuid" FOREIGN KEY ("assignedByUuid") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" ADD CONSTRAINT "EX_resource_assignments_no_active_overlap" EXCLUDE USING gist ("resourceUuid" WITH =, daterange("startDate", "endDate", '[]') WITH &&) WHERE ("deletedAt" IS NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" DROP CONSTRAINT "EX_resource_assignments_no_active_overlap"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" DROP CONSTRAINT "FK_resource_assignments_assigned_by_uuid_users_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" DROP CONSTRAINT "FK_resource_assignments_task_uuid_tasks_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" DROP CONSTRAINT "FK_resource_assignments_project_uuid_projects_uuid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resource_assignments" DROP CONSTRAINT "FK_resource_assignments_resource_uuid_resources_uuid"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_resource_assignments_resource_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resource_assignments_project_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resource_assignments_task_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resource_assignments_assigned_by_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resource_assignments_start_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resource_assignments_end_date"`);
    await queryRunner.query(`DROP TABLE "resource_assignments"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resources_category"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resources_operational_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resources_is_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_resources_deleted_at"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_resources_code"`);
    await queryRunner.query(`DROP TABLE "resources"`);
    await queryRunner.query(`DROP TYPE "public"."resource_operational_status"`);
    await queryRunner.query(`DROP TYPE "public"."resource_category"`);
  }
}
