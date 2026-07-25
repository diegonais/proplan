import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcrypt';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { AppModule } from '../../app.module';
import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskDependencyType } from '../../common/enums/task-dependency-type.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { EnvironmentVariables } from '../../config/env.validation';
import { ProjectMember } from '../../modules/project-members/entities/project-member.entity';
import { Project } from '../../modules/projects/entities/project.entity';
import { TaskAssignment } from '../../modules/task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../../modules/task-dependencies/entities/task-dependency.entity';
import { Task } from '../../modules/tasks/entities/task.entity';
import { User } from '../../modules/users/entities/user.entity';

const logger = new Logger('SeedDemoData');
const DEFAULT_DEMO_PASSWORD = 'ProplanDemo2026!';

interface DemoUser {
  key: string;
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
}

interface DemoProject {
  key: string;
  uuid: string;
  name: string;
  description: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  approvedBudget: string;
  managerKey: string;
  memberKeys: string[];
}

interface DemoTask {
  key: string;
  uuid: string;
  projectKey: string;
  parentTaskKey: string | null;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  estimatedHours: string;
  plannedBudget: string;
  actualCost: string;
}

interface DemoDependency {
  uuid: string;
  predecessorTaskKey: string;
  successorTaskKey: string;
}

interface DemoAssignment {
  taskKey: string;
  userKey: string;
  assignedHours: string;
  isMainResponsible: boolean;
}

const users: DemoUser[] = [
  {
    key: 'admin',
    uuid: '11111111-1111-4111-8111-111111111111',
    name: 'Administrador PROPLAN',
    email: 'admin@proplan.local',
    role: UserRole.ADMIN,
  },
  {
    key: 'pmPlanning',
    uuid: '22222222-2222-4222-8222-222222222222',
    name: 'Laura Mamani',
    email: 'laura.mamani@proplan.local',
    role: UserRole.PROJECT_MANAGER,
  },
  {
    key: 'pmOperations',
    uuid: '33333333-3333-4333-8333-333333333333',
    name: 'Carlos Quispe',
    email: 'carlos.quispe@proplan.local',
    role: UserRole.PROJECT_MANAGER,
  },
  {
    key: 'analyst',
    uuid: '44444444-4444-4444-8444-444444444444',
    name: 'Ana Choque',
    email: 'ana.choque@proplan.local',
    role: UserRole.USER,
  },
  {
    key: 'developer',
    uuid: '55555555-5555-4555-8555-555555555555',
    name: 'Roberto Vargas',
    email: 'roberto.vargas@proplan.local',
    role: UserRole.USER,
  },
  {
    key: 'qa',
    uuid: '66666666-6666-4666-8666-666666666666',
    name: 'Maria Flores',
    email: 'maria.flores@proplan.local',
    role: UserRole.USER,
  },
  {
    key: 'designer',
    uuid: '77777777-7777-4777-8777-777777777777',
    name: 'Diego Rivera',
    email: 'diego.rivera@proplan.local',
    role: UserRole.USER,
  },
  {
    key: 'finance',
    uuid: '88888888-8888-4888-8888-888888888888',
    name: 'Sofia Nunez',
    email: 'sofia.nunez@proplan.local',
    role: UserRole.USER,
  },
];

const projects: DemoProject[] = [
  {
    key: 'greenPlanning',
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    name: 'Portal de seguimiento academico',
    description: 'Proyecto de demostracion en planificacion, sin retrasos ni desviacion financiera.',
    objective: 'Preparar un portal interno para seguimiento de actividades y reportes academicos.',
    startDate: '2026-08-01',
    endDate: '2026-12-15',
    status: ProjectStatus.PLANNING,
    approvedBudget: '160000.00',
    managerKey: 'pmPlanning',
    memberKeys: ['pmPlanning', 'analyst', 'developer', 'designer'],
  },
  {
    key: 'yellowCosts',
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    name: 'Implementacion de control de costos',
    description: 'Proyecto en ejecucion con consumo presupuestario en zona de advertencia.',
    objective: 'Centralizar el registro de presupuesto planificado y costo ejecutado por actividad.',
    startDate: '2026-05-01',
    endDate: '2026-11-30',
    status: ProjectStatus.IN_PROGRESS,
    approvedBudget: '85000.00',
    managerKey: 'pmPlanning',
    memberKeys: ['pmPlanning', 'analyst', 'developer', 'qa', 'finance'],
  },
  {
    key: 'redMigration',
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    name: 'Migracion de planificacion operativa',
    description: 'Proyecto critico para mostrar sobrepresupuesto, vencimiento y actividades atrasadas.',
    objective: 'Migrar cronogramas operativos dispersos hacia PROPLAN con trazabilidad de dependencias.',
    startDate: '2026-02-01',
    endDate: '2026-07-10',
    status: ProjectStatus.IN_PROGRESS,
    approvedBudget: '60000.00',
    managerKey: 'pmOperations',
    memberKeys: ['pmOperations', 'analyst', 'developer', 'qa', 'finance'],
  },
  {
    key: 'completedPilot',
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    name: 'Cierre de implementacion piloto',
    description: 'Proyecto finalizado para demostrar historico, reportes y exportaciones.',
    objective: 'Cerrar el piloto academico con actividades completadas y costo controlado.',
    startDate: '2026-03-01',
    endDate: '2026-06-30',
    status: ProjectStatus.COMPLETED,
    approvedBudget: '45000.00',
    managerKey: 'pmOperations',
    memberKeys: ['pmOperations', 'designer', 'qa', 'finance'],
  },
];

const tasks: DemoTask[] = [
  {
    key: 'greenDiscovery',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101',
    projectKey: 'greenPlanning',
    parentTaskKey: null,
    name: 'Levantamiento funcional',
    description: 'Identificar necesidades del equipo academico y alcance de la primera version.',
    startDate: '2026-08-01',
    endDate: '2026-08-20',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '80.00',
    plannedBudget: '12000.00',
    actualCost: '0.00',
  },
  {
    key: 'greenDesign',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb102',
    projectKey: 'greenPlanning',
    parentTaskKey: null,
    name: 'Diseno de interfaz Material',
    description: 'Definir pantallas principales con componentes Material UI.',
    startDate: '2026-08-21',
    endDate: '2026-09-15',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '96.00',
    plannedBudget: '18000.00',
    actualCost: '0.00',
  },
  {
    key: 'greenDashboardPrototype',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103',
    projectKey: 'greenPlanning',
    parentTaskKey: 'greenDesign',
    name: 'Prototipo de dashboard',
    description: 'Preparar la vista de resumen con indicadores de avance, carga y presupuesto.',
    startDate: '2026-08-25',
    endDate: '2026-09-05',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '40.00',
    plannedBudget: '7000.00',
    actualCost: '0.00',
  },
  {
    key: 'greenProjectsModule',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb104',
    projectKey: 'greenPlanning',
    parentTaskKey: null,
    name: 'Implementacion del modulo de proyectos',
    description: 'Construir CRUD de proyectos, validaciones y estados visibles para la demo.',
    startDate: '2026-09-16',
    endDate: '2026-10-30',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '160.00',
    plannedBudget: '35000.00',
    actualCost: '0.00',
  },
  {
    key: 'yellowAnalysis',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb201',
    projectKey: 'yellowCosts',
    parentTaskKey: null,
    name: 'Analisis presupuestario inicial',
    description: 'Definir reglas de presupuesto aprobado, presupuesto planificado y costo ejecutado.',
    startDate: '2026-05-01',
    endDate: '2026-05-20',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '70.00',
    plannedBudget: '14000.00',
    actualCost: '15000.00',
  },
  {
    key: 'yellowBudgetLoad',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb202',
    projectKey: 'yellowCosts',
    parentTaskKey: null,
    name: 'Carga de presupuesto por actividad',
    description: 'Registrar presupuesto planificado por actividad y mostrar diferencias.',
    startDate: '2026-05-21',
    endDate: '2026-07-20',
    status: TaskStatus.IN_PROGRESS,
    progress: 70,
    estimatedHours: '120.00',
    plannedBudget: '22000.00',
    actualCost: '21000.00',
  },
  {
    key: 'yellowValidation',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb203',
    projectKey: 'yellowCosts',
    parentTaskKey: null,
    name: 'Validacion de costos ejecutados',
    description: 'Contrastar costos ejecutados contra el avance informado por los responsables.',
    startDate: '2026-07-21',
    endDate: '2026-09-10',
    status: TaskStatus.IN_PROGRESS,
    progress: 35,
    estimatedHours: '110.00',
    plannedBudget: '24000.00',
    actualCost: '25000.00',
  },
  {
    key: 'yellowValidationRules',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb204',
    projectKey: 'yellowCosts',
    parentTaskKey: 'yellowValidation',
    name: 'Reglas de validacion financiera',
    description: 'Documentar y probar casos de consumo, saldo y sobrepresupuesto.',
    startDate: '2026-07-25',
    endDate: '2026-08-20',
    status: TaskStatus.IN_PROGRESS,
    progress: 25,
    estimatedHours: '44.00',
    plannedBudget: '9000.00',
    actualCost: '8000.00',
  },
  {
    key: 'yellowExport',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb205',
    projectKey: 'yellowCosts',
    parentTaskKey: null,
    name: 'Exportacion financiera',
    description: 'Preparar salidas PDF y Excel para el resumen financiero.',
    startDate: '2026-09-11',
    endDate: '2026-11-20',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '90.00',
    plannedBudget: '16000.00',
    actualCost: '1000.00',
  },
  {
    key: 'redInventory',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb301',
    projectKey: 'redMigration',
    parentTaskKey: null,
    name: 'Inventario de actividades existentes',
    description: 'Consolidar actividades dispersas de hojas de calculo de la organizacion.',
    startDate: '2026-02-01',
    endDate: '2026-02-20',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '80.00',
    plannedBudget: '10000.00',
    actualCost: '12000.00',
  },
  {
    key: 'redSchedule',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb302',
    projectKey: 'redMigration',
    parentTaskKey: null,
    name: 'Normalizacion de cronograma',
    description: 'Convertir actividades antiguas a fechas, dependencias y responsables de PROPLAN.',
    startDate: '2026-02-21',
    endDate: '2026-05-15',
    status: TaskStatus.IN_PROGRESS,
    progress: 60,
    estimatedHours: '150.00',
    plannedBudget: '18000.00',
    actualCost: '24000.00',
  },
  {
    key: 'redHistoricLoad',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb303',
    projectKey: 'redMigration',
    parentTaskKey: null,
    name: 'Carga historica de actividades',
    description: 'Registrar actividades anteriores, miembros y costos ejecutados acumulados.',
    startDate: '2026-05-16',
    endDate: '2026-06-15',
    status: TaskStatus.BLOCKED,
    progress: 35,
    estimatedHours: '120.00',
    plannedBudget: '15000.00',
    actualCost: '19000.00',
  },
  {
    key: 'redHistoricReview',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb304',
    projectKey: 'redMigration',
    parentTaskKey: 'redHistoricLoad',
    name: 'Revision de datos cargados',
    description: 'Verificar consistencia de fechas, responsables y costos migrados.',
    startDate: '2026-05-20',
    endDate: '2026-06-10',
    status: TaskStatus.BLOCKED,
    progress: 20,
    estimatedHours: '48.00',
    plannedBudget: '7000.00',
    actualCost: '9000.00',
  },
  {
    key: 'redValidation',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb305',
    projectKey: 'redMigration',
    parentTaskKey: null,
    name: 'Validacion con jefaturas',
    description: 'Revisar el plan migrado con jefes de proyecto y responsables principales.',
    startDate: '2026-06-16',
    endDate: '2026-07-05',
    status: TaskStatus.IN_PROGRESS,
    progress: 40,
    estimatedHours: '80.00',
    plannedBudget: '11000.00',
    actualCost: '10000.00',
  },
  {
    key: 'redClosure',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb306',
    projectKey: 'redMigration',
    parentTaskKey: null,
    name: 'Ajustes finales de migracion',
    description: 'Resolver observaciones antes de cerrar la migracion operativa.',
    startDate: '2026-07-06',
    endDate: '2026-07-10',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '40.00',
    plannedBudget: '6000.00',
    actualCost: '2000.00',
  },
  {
    key: 'completedPreparation',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb401',
    projectKey: 'completedPilot',
    parentTaskKey: null,
    name: 'Preparacion del piloto',
    description: 'Configurar el alcance de la demostracion piloto.',
    startDate: '2026-03-01',
    endDate: '2026-03-20',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '60.00',
    plannedBudget: '9000.00',
    actualCost: '8500.00',
  },
  {
    key: 'completedExecution',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb402',
    projectKey: 'completedPilot',
    parentTaskKey: null,
    name: 'Ejecucion del piloto',
    description: 'Ejecutar actividades principales y validar reportes.',
    startDate: '2026-03-21',
    endDate: '2026-05-30',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '140.00',
    plannedBudget: '26000.00',
    actualCost: '25500.00',
  },
  {
    key: 'completedClosure',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb403',
    projectKey: 'completedPilot',
    parentTaskKey: null,
    name: 'Cierre y lecciones aprendidas',
    description: 'Preparar cierre del piloto y documentacion para el equipo.',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '50.00',
    plannedBudget: '10000.00',
    actualCost: '9000.00',
  },
];

const dependencies: DemoDependency[] = [
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
    predecessorTaskKey: 'greenDiscovery',
    successorTaskKey: 'greenDesign',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
    predecessorTaskKey: 'greenDesign',
    successorTaskKey: 'greenProjectsModule',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc03',
    predecessorTaskKey: 'yellowAnalysis',
    successorTaskKey: 'yellowBudgetLoad',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc04',
    predecessorTaskKey: 'yellowBudgetLoad',
    successorTaskKey: 'yellowValidation',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc05',
    predecessorTaskKey: 'yellowValidation',
    successorTaskKey: 'yellowExport',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc06',
    predecessorTaskKey: 'redInventory',
    successorTaskKey: 'redSchedule',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc07',
    predecessorTaskKey: 'redSchedule',
    successorTaskKey: 'redHistoricLoad',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc08',
    predecessorTaskKey: 'redHistoricLoad',
    successorTaskKey: 'redValidation',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc09',
    predecessorTaskKey: 'redValidation',
    successorTaskKey: 'redClosure',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc10',
    predecessorTaskKey: 'completedPreparation',
    successorTaskKey: 'completedExecution',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc11',
    predecessorTaskKey: 'completedExecution',
    successorTaskKey: 'completedClosure',
  },
];

const assignments: DemoAssignment[] = [
  { taskKey: 'greenDiscovery', userKey: 'analyst', assignedHours: '60.00', isMainResponsible: true },
  { taskKey: 'greenDiscovery', userKey: 'pmPlanning', assignedHours: '20.00', isMainResponsible: false },
  { taskKey: 'greenDesign', userKey: 'designer', assignedHours: '76.00', isMainResponsible: true },
  { taskKey: 'greenDesign', userKey: 'analyst', assignedHours: '20.00', isMainResponsible: false },
  {
    taskKey: 'greenDashboardPrototype',
    userKey: 'designer',
    assignedHours: '30.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'greenDashboardPrototype',
    userKey: 'developer',
    assignedHours: '10.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'greenProjectsModule',
    userKey: 'developer',
    assignedHours: '130.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'greenProjectsModule',
    userKey: 'pmPlanning',
    assignedHours: '30.00',
    isMainResponsible: false,
  },
  { taskKey: 'yellowAnalysis', userKey: 'finance', assignedHours: '45.00', isMainResponsible: true },
  { taskKey: 'yellowAnalysis', userKey: 'pmPlanning', assignedHours: '25.00', isMainResponsible: false },
  { taskKey: 'yellowBudgetLoad', userKey: 'developer', assignedHours: '80.00', isMainResponsible: true },
  { taskKey: 'yellowBudgetLoad', userKey: 'finance', assignedHours: '40.00', isMainResponsible: false },
  { taskKey: 'yellowValidation', userKey: 'qa', assignedHours: '70.00', isMainResponsible: true },
  { taskKey: 'yellowValidation', userKey: 'finance', assignedHours: '40.00', isMainResponsible: false },
  {
    taskKey: 'yellowValidationRules',
    userKey: 'qa',
    assignedHours: '30.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'yellowValidationRules',
    userKey: 'analyst',
    assignedHours: '14.00',
    isMainResponsible: false,
  },
  { taskKey: 'yellowExport', userKey: 'developer', assignedHours: '60.00', isMainResponsible: true },
  { taskKey: 'yellowExport', userKey: 'qa', assignedHours: '30.00', isMainResponsible: false },
  { taskKey: 'redInventory', userKey: 'analyst', assignedHours: '55.00', isMainResponsible: true },
  { taskKey: 'redInventory', userKey: 'pmOperations', assignedHours: '25.00', isMainResponsible: false },
  { taskKey: 'redSchedule', userKey: 'developer', assignedHours: '110.00', isMainResponsible: true },
  { taskKey: 'redSchedule', userKey: 'analyst', assignedHours: '40.00', isMainResponsible: false },
  { taskKey: 'redHistoricLoad', userKey: 'developer', assignedHours: '80.00', isMainResponsible: true },
  { taskKey: 'redHistoricLoad', userKey: 'finance', assignedHours: '40.00', isMainResponsible: false },
  { taskKey: 'redHistoricReview', userKey: 'qa', assignedHours: '32.00', isMainResponsible: true },
  { taskKey: 'redHistoricReview', userKey: 'finance', assignedHours: '16.00', isMainResponsible: false },
  { taskKey: 'redValidation', userKey: 'pmOperations', assignedHours: '30.00', isMainResponsible: true },
  { taskKey: 'redValidation', userKey: 'qa', assignedHours: '50.00', isMainResponsible: false },
  { taskKey: 'redClosure', userKey: 'developer', assignedHours: '25.00', isMainResponsible: true },
  { taskKey: 'redClosure', userKey: 'pmOperations', assignedHours: '15.00', isMainResponsible: false },
  { taskKey: 'completedPreparation', userKey: 'designer', assignedHours: '40.00', isMainResponsible: true },
  { taskKey: 'completedPreparation', userKey: 'pmOperations', assignedHours: '20.00', isMainResponsible: false },
  { taskKey: 'completedExecution', userKey: 'qa', assignedHours: '90.00', isMainResponsible: true },
  { taskKey: 'completedExecution', userKey: 'designer', assignedHours: '50.00', isMainResponsible: false },
  { taskKey: 'completedClosure', userKey: 'finance', assignedHours: '35.00', isMainResponsible: true },
  { taskKey: 'completedClosure', userKey: 'pmOperations', assignedHours: '15.00', isMainResponsible: false },
];

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    const nodeEnvironment = configService.get('NODE_ENV', { infer: true });

    if (nodeEnvironment === 'production') {
      throw new Error('The demo seed must not run in production.');
    }

    const configuredDemoPassword = process.env.DEMO_SEED_PASSWORD?.trim();
    const demoPassword =
      configuredDemoPassword === undefined || configuredDemoPassword.length === 0
        ? DEFAULT_DEMO_PASSWORD
        : configuredDemoPassword;
    const saltRounds = configService.get('BCRYPT_SALT_ROUNDS', { infer: true });
    const passwordHash = await hash(demoPassword, saltRounds);
    const dataSource = app.get(DataSource);

    await dataSource.transaction(async (entityManager) => {
      const userRepository = entityManager.getRepository(User);
      const projectRepository = entityManager.getRepository(Project);
      const projectMemberRepository = entityManager.getRepository(ProjectMember);
      const taskRepository = entityManager.getRepository(Task);
      const taskAssignmentRepository = entityManager.getRepository(TaskAssignment);
      const taskDependencyRepository = entityManager.getRepository(TaskDependency);

      const userUuidByKey = await seedUsers(userRepository, passwordHash);
      const projectUuidByKey = await seedProjects(projectRepository, userUuidByKey);
      await seedProjectMembers(projectMemberRepository, userUuidByKey, projectUuidByKey);
      const taskUuidByKey = await seedTasks(taskRepository, projectUuidByKey);
      await seedDependencies(taskDependencyRepository, taskUuidByKey);
      await seedAssignments(taskAssignmentRepository, taskUuidByKey, userUuidByKey);
    });

    logger.log('Demo data seed completed. It can be run again without duplicating demo records.');
    logger.log(`Demo password source: ${process.env.DEMO_SEED_PASSWORD ? 'DEMO_SEED_PASSWORD' : 'local default'}.`);
  } finally {
    await app.close();
  }
}

async function seedUsers(
  userRepository: Repository<User>,
  passwordHash: string,
): Promise<Map<string, string>> {
  const userUuidByKey = new Map<string, string>();

  for (const user of users) {
    const email = user.email.toLowerCase();
    const existingUser = await userRepository.findOne({
      where: [{ uuid: user.uuid }, { email }],
    });
    const userEntity = existingUser ?? userRepository.create({ uuid: user.uuid });

    userEntity.name = user.name;
    userEntity.email = email;
    userEntity.passwordHash = passwordHash;
    userEntity.role = user.role;
    userEntity.isActive = true;

    const savedUser = await userRepository.save(userEntity);

    userUuidByKey.set(user.key, savedUser.uuid);
  }

  return userUuidByKey;
}

async function seedProjects(
  projectRepository: Repository<Project>,
  userUuidByKey: ReadonlyMap<string, string>,
): Promise<Map<string, string>> {
  const projectUuidByKey = new Map<string, string>();

  for (const project of projects) {
    const managerUuid = getRequiredMapValue(userUuidByKey, project.managerKey, 'user');
    const existingProject = await projectRepository.findOne({
      where: { uuid: project.uuid },
      withDeleted: true,
    });
    const projectEntity = existingProject ?? projectRepository.create({ uuid: project.uuid });

    projectEntity.name = project.name;
    projectEntity.description = project.description;
    projectEntity.objective = project.objective;
    projectEntity.startDate = project.startDate;
    projectEntity.endDate = project.endDate;
    projectEntity.status = project.status;
    projectEntity.approvedBudget = project.approvedBudget;
    projectEntity.managerUuid = managerUuid;
    projectEntity.deletedAt = null;

    const savedProject = await projectRepository.save(projectEntity);

    projectUuidByKey.set(project.key, savedProject.uuid);
  }

  return projectUuidByKey;
}

async function seedProjectMembers(
  projectMemberRepository: Repository<ProjectMember>,
  userUuidByKey: ReadonlyMap<string, string>,
  projectUuidByKey: ReadonlyMap<string, string>,
): Promise<void> {
  for (const project of projects) {
    const projectUuid = getRequiredMapValue(projectUuidByKey, project.key, 'project');

    for (const userKey of project.memberKeys) {
      const userUuid = getRequiredMapValue(userUuidByKey, userKey, 'user');
      await ensureProjectMember(projectMemberRepository, projectUuid, userUuid);
    }
  }
}

async function seedTasks(
  taskRepository: Repository<Task>,
  projectUuidByKey: ReadonlyMap<string, string>,
): Promise<Map<string, string>> {
  const taskUuidByKey = new Map<string, string>();

  for (const task of tasks) {
    const projectUuid = getRequiredMapValue(projectUuidByKey, task.projectKey, 'project');
    const parentTaskUuid =
      task.parentTaskKey === null
        ? null
        : getRequiredMapValue(taskUuidByKey, task.parentTaskKey, 'parent task');
    const existingTask = await taskRepository.findOne({
      where: { uuid: task.uuid },
      withDeleted: true,
    });
    const taskEntity = existingTask ?? taskRepository.create({ uuid: task.uuid });

    taskEntity.projectUuid = projectUuid;
    taskEntity.parentTaskUuid = parentTaskUuid;
    taskEntity.name = task.name;
    taskEntity.description = task.description;
    taskEntity.startDate = task.startDate;
    taskEntity.endDate = task.endDate;
    taskEntity.status = task.status;
    taskEntity.progress = task.progress;
    taskEntity.estimatedHours = task.estimatedHours;
    taskEntity.plannedBudget = task.plannedBudget;
    taskEntity.actualCost = task.actualCost;
    taskEntity.deletedAt = null;

    const savedTask = await taskRepository.save(taskEntity);

    taskUuidByKey.set(task.key, savedTask.uuid);
  }

  return taskUuidByKey;
}

async function seedDependencies(
  taskDependencyRepository: Repository<TaskDependency>,
  taskUuidByKey: ReadonlyMap<string, string>,
): Promise<void> {
  for (const dependency of dependencies) {
    const predecessorTaskUuid = getRequiredMapValue(
      taskUuidByKey,
      dependency.predecessorTaskKey,
      'predecessor task',
    );
    const successorTaskUuid = getRequiredMapValue(
      taskUuidByKey,
      dependency.successorTaskKey,
      'successor task',
    );
    const existingDependency = await taskDependencyRepository.findOne({
      where: [
        { uuid: dependency.uuid },
        {
          predecessorTaskUuid,
          successorTaskUuid,
          dependencyType: TaskDependencyType.FINISH_TO_START,
        },
      ],
    });

    const dependencyEntity =
      existingDependency ?? taskDependencyRepository.create({ uuid: dependency.uuid });

    dependencyEntity.predecessorTaskUuid = predecessorTaskUuid;
    dependencyEntity.successorTaskUuid = successorTaskUuid;
    dependencyEntity.dependencyType = TaskDependencyType.FINISH_TO_START;

    await taskDependencyRepository.save(dependencyEntity);
  }
}

async function seedAssignments(
  taskAssignmentRepository: Repository<TaskAssignment>,
  taskUuidByKey: ReadonlyMap<string, string>,
  userUuidByKey: ReadonlyMap<string, string>,
): Promise<void> {
  const demoTaskUuids = [...taskUuidByKey.values()];

  for (const taskUuid of demoTaskUuids) {
    await taskAssignmentRepository.update({ taskUuid }, { isMainResponsible: false });
  }

  for (const assignment of assignments) {
    const taskUuid = getRequiredMapValue(taskUuidByKey, assignment.taskKey, 'task');
    const userUuid = getRequiredMapValue(userUuidByKey, assignment.userKey, 'user');
    const existingAssignment = await taskAssignmentRepository.findOne({
      where: { taskUuid, userUuid },
    });

    const assignmentEntity = existingAssignment ?? taskAssignmentRepository.create();

    assignmentEntity.taskUuid = taskUuid;
    assignmentEntity.userUuid = userUuid;
    assignmentEntity.assignedHours = assignment.assignedHours;
    assignmentEntity.isMainResponsible = assignment.isMainResponsible;

    await taskAssignmentRepository.save(assignmentEntity);
  }
}

async function ensureProjectMember(
  projectMemberRepository: Repository<ProjectMember>,
  projectUuid: string,
  userUuid: string,
): Promise<void> {
  const where: FindOptionsWhere<ProjectMember> = { projectUuid, userUuid };
  const existingMembership = await projectMemberRepository.findOne({ where });

  if (existingMembership !== null) {
    return;
  }

  await projectMemberRepository.save(
    projectMemberRepository.create({
      projectUuid,
      userUuid,
    }),
  );
}

function getRequiredMapValue(
  values: ReadonlyMap<string, string>,
  key: string,
  entityName: string,
): string {
  const value = values.get(key);

  if (value === undefined) {
    throw new Error(`Missing ${entityName} seed reference for key ${key}.`);
  }

  return value;
}

void bootstrap();
