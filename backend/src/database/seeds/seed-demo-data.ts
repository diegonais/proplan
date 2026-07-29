import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcrypt';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { AppModule } from '../../app.module';
import { ProjectStatus } from '../../common/enums/project-status.enum';
import { ResourceCategory } from '../../common/enums/resource-category.enum';
import { ResourceOperationalStatus } from '../../common/enums/resource-operational-status.enum';
import { TaskDependencyType } from '../../common/enums/task-dependency-type.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { EnvironmentVariables } from '../../config/env.validation';
import { ProjectMember } from '../../modules/project-members/entities/project-member.entity';
import { Project } from '../../modules/projects/entities/project.entity';
import { ResourceAssignment } from '../../modules/resource-assignments/entities/resource-assignment.entity';
import { Resource } from '../../modules/resources/entities/resource.entity';
import { TaskAssignment } from '../../modules/task-assignments/entities/task-assignment.entity';
import { TaskDependency } from '../../modules/task-dependencies/entities/task-dependency.entity';
import { Task } from '../../modules/tasks/entities/task.entity';
import { User } from '../../modules/users/entities/user.entity';

const logger = new Logger('SeedDemoData');
const DEFAULT_DEMO_PASSWORD = 'ProplanDemo2026!';
const RETIRED_DEMO_PROJECT_UUIDS: readonly string[] = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'];

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

interface DemoResource {
  key: string;
  uuid: string;
  name: string;
  description: string;
  code: string;
  category: ResourceCategory;
  serialNumber: string | null;
  operationalStatus: ResourceOperationalStatus;
  notes: string | null;
  isActive: boolean;
}

interface DemoResourceAssignment {
  uuid: string;
  resourceKey: string;
  projectKey: string;
  taskKey: string | null;
  startDate: string;
  endDate: string;
  assignedByKey: string;
  notes: string | null;
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
    key: 'lastMile2025',
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    name: 'Sistema de entregas de ultima milla',
    description:
      'Proyecto finalizado a fines de 2025 para digitalizar el seguimiento de entregas urbanas.',
    objective:
      'Centralizar rutas, evidencia de entrega y trazabilidad basica para operaciones de ultima milla.',
    startDate: '2025-09-15',
    endDate: '2025-12-19',
    status: ProjectStatus.COMPLETED,
    approvedBudget: '95000.00',
    managerKey: 'pmOperations',
    memberKeys: ['pmOperations', 'analyst', 'developer', 'qa', 'designer'],
  },
  {
    key: 'coldChain2026',
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    name: 'Plataforma de monitoreo de cadena fria',
    description:
      'Proyecto finalizado durante la primera mitad de 2026 para consolidar telemetria de transporte refrigerado.',
    objective:
      'Monitorear temperatura, alertas y cumplimiento de rutas para clientes de carga sensible.',
    startDate: '2026-01-12',
    endDate: '2026-06-26',
    status: ProjectStatus.COMPLETED,
    approvedBudget: '135000.00',
    managerKey: 'pmPlanning',
    memberKeys: ['pmPlanning', 'analyst', 'developer', 'qa', 'finance'],
  },
  {
    key: 'routeOptimizer2026',
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    name: 'Optimizador de rutas y despacho',
    description:
      'Proyecto abierto para la segunda mitad de 2026 con asignaciones activas de personal y recursos.',
    objective:
      'Planificar rutas, priorizar despachos y medir disponibilidad de recursos tecnologicos de transporte.',
    startDate: '2026-07-01',
    endDate: '2026-12-18',
    status: ProjectStatus.IN_PROGRESS,
    approvedBudget: '210000.00',
    managerKey: 'pmPlanning',
    memberKeys: ['pmPlanning', 'analyst', 'developer', 'qa', 'designer', 'finance'],
  },
];

const tasks: DemoTask[] = [
  {
    key: 'lastMileDiscovery',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101',
    projectKey: 'lastMile2025',
    parentTaskKey: null,
    name: 'Levantamiento de operacion de entregas',
    description:
      'Identificar flujo de despacho, evidencia de entrega y seguimiento de unidades urbanas.',
    startDate: '2025-09-15',
    endDate: '2025-10-03',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '80.00',
    plannedBudget: '14000.00',
    actualCost: '13200.00',
  },
  {
    key: 'lastMileGpsIntegration',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb102',
    projectKey: 'lastMile2025',
    parentTaskKey: null,
    name: 'Integracion de trazabilidad GPS',
    description: 'Conectar eventos de ubicacion de unidades con el tablero interno de entregas.',
    startDate: '2025-10-06',
    endDate: '2025-10-31',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '96.00',
    plannedBudget: '21000.00',
    actualCost: '20500.00',
  },
  {
    key: 'lastMileMobileProof',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103',
    projectKey: 'lastMile2025',
    parentTaskKey: 'lastMileGpsIntegration',
    name: 'Pruebas de evidencia movil',
    description: 'Validar captura de fotografias, firma y confirmacion de entrega en dispositivos.',
    startDate: '2025-11-03',
    endDate: '2025-11-28',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '40.00',
    plannedBudget: '18000.00',
    actualCost: '17600.00',
  },
  {
    key: 'lastMileClosure',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb104',
    projectKey: 'lastMile2025',
    parentTaskKey: null,
    name: 'Cierre operativo y capacitacion',
    description: 'Entregar manual operativo, validar reportes finales y capacitar al equipo de despacho.',
    startDate: '2025-12-01',
    endDate: '2025-12-19',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '160.00',
    plannedBudget: '26000.00',
    actualCost: '24800.00',
  },
  {
    key: 'coldChainAnalysis',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb201',
    projectKey: 'coldChain2026',
    parentTaskKey: null,
    name: 'Analisis de telemetria refrigerada',
    description:
      'Definir variables de temperatura, ubicacion y eventos criticos para transporte refrigerado.',
    startDate: '2026-01-12',
    endDate: '2026-02-06',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '70.00',
    plannedBudget: '18000.00',
    actualCost: '17600.00',
  },
  {
    key: 'coldChainBackend',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb202',
    projectKey: 'coldChain2026',
    parentTaskKey: null,
    name: 'Servicios de monitoreo y alertas',
    description: 'Implementar API para lecturas, alertas de temperatura y bitacora de eventos.',
    startDate: '2026-02-09',
    endDate: '2026-03-27',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '120.00',
    plannedBudget: '40000.00',
    actualCost: '39200.00',
  },
  {
    key: 'coldChainDashboard',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb203',
    projectKey: 'coldChain2026',
    parentTaskKey: null,
    name: 'Dashboard de cumplimiento de ruta',
    description: 'Mostrar estado de vehiculos, temperatura, desviaciones y evidencias consolidadas.',
    startDate: '2026-03-30',
    endDate: '2026-04-30',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '110.00',
    plannedBudget: '30000.00',
    actualCost: '28800.00',
  },
  {
    key: 'coldChainQa',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb204',
    projectKey: 'coldChain2026',
    parentTaskKey: 'coldChainDashboard',
    name: 'Pruebas de sensores y dispositivos',
    description: 'Validar lecturas simuladas, dispositivos moviles y compatibilidad de reportes.',
    startDate: '2026-05-04',
    endDate: '2026-06-05',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '44.00',
    plannedBudget: '22000.00',
    actualCost: '21400.00',
  },
  {
    key: 'coldChainClosure',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb205',
    projectKey: 'coldChain2026',
    parentTaskKey: null,
    name: 'Cierre y reporte ejecutivo',
    description: 'Consolidar costos, carga de trabajo y resultados del piloto de cadena fria.',
    startDate: '2026-06-08',
    endDate: '2026-06-26',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '90.00',
    plannedBudget: '17000.00',
    actualCost: '16400.00',
  },
  {
    key: 'routeKickoff',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb301',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Definicion de alcance del optimizador',
    description: 'Acordar reglas de prioridad, restricciones de vehiculos y objetivos de despacho.',
    startDate: '2026-07-01',
    endDate: '2026-07-10',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '80.00',
    plannedBudget: '18000.00',
    actualCost: '16800.00',
  },
  {
    key: 'routeDataModel',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb302',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Modelo de datos de rutas y recursos',
    description: 'Diseñar entidades para rutas, ventanas de entrega, vehiculos y recursos tecnologicos.',
    startDate: '2026-07-11',
    endDate: '2026-07-24',
    status: TaskStatus.COMPLETED,
    progress: 100,
    estimatedHours: '150.00',
    plannedBudget: '26000.00',
    actualCost: '25100.00',
  },
  {
    key: 'routeGpsIntegration',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb303',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Integracion inicial con GPS de flota',
    description:
      'Recibir posiciones de vehiculos para alimentar la matriz de rutas. Actividad vencida para demo.',
    startDate: '2026-07-25',
    endDate: '2026-07-28',
    status: TaskStatus.IN_PROGRESS,
    progress: 70,
    estimatedHours: '120.00',
    plannedBudget: '24000.00',
    actualCost: '18000.00',
  },
  {
    key: 'routeProviderApi',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb304',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Conexion con API de proveedor GPS',
    description: 'Actividad bloqueada por credenciales pendientes del proveedor de telemetria.',
    startDate: '2026-07-29',
    endDate: '2026-08-15',
    status: TaskStatus.BLOCKED,
    progress: 30,
    estimatedHours: '48.00',
    plannedBudget: '14000.00',
    actualCost: '5200.00',
  },
  {
    key: 'routeAlgorithm',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb305',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Motor de optimizacion de rutas',
    description: 'Calcular secuencias de despacho considerando carga, ventanas horarias y distancia.',
    startDate: '2026-07-29',
    endDate: '2026-09-15',
    status: TaskStatus.IN_PROGRESS,
    progress: 20,
    estimatedHours: '80.00',
    plannedBudget: '42000.00',
    actualCost: '12000.00',
  },
  {
    key: 'routeDispatchBoard',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb306',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Tablero de despacho operativo',
    description: 'Construir vista para asignar rutas, revisar recursos ocupados y monitorear avance.',
    startDate: '2026-08-10',
    endDate: '2026-10-05',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '40.00',
    plannedBudget: '30000.00',
    actualCost: '0.00',
  },
  {
    key: 'routeMobileQa',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb401',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Validacion movil en campo',
    description: 'Probar tabletas y telefonos con rutas asignadas, evidencia y estados de despacho.',
    startDate: '2026-09-20',
    endDate: '2026-11-05',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '60.00',
    plannedBudget: '20000.00',
    actualCost: '0.00',
  },
  {
    key: 'routePilot',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb402',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Piloto con operaciones de transporte',
    description: 'Ejecutar piloto controlado con despachos reales y seguimiento de recursos asignados.',
    startDate: '2026-11-06',
    endDate: '2026-12-04',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '140.00',
    plannedBudget: '23000.00',
    actualCost: '0.00',
  },
  {
    key: 'routeClosure',
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb403',
    projectKey: 'routeOptimizer2026',
    parentTaskKey: null,
    name: 'Cierre y adopcion interna',
    description: 'Consolidar resultados, exportaciones y recomendaciones para evolucionar el sistema.',
    startDate: '2026-12-07',
    endDate: '2026-12-18',
    status: TaskStatus.PENDING,
    progress: 0,
    estimatedHours: '50.00',
    plannedBudget: '8000.00',
    actualCost: '0.00',
  },
];

const dependencies: DemoDependency[] = [
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
    predecessorTaskKey: 'lastMileDiscovery',
    successorTaskKey: 'lastMileGpsIntegration',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
    predecessorTaskKey: 'lastMileGpsIntegration',
    successorTaskKey: 'lastMileMobileProof',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc03',
    predecessorTaskKey: 'lastMileMobileProof',
    successorTaskKey: 'lastMileClosure',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc04',
    predecessorTaskKey: 'coldChainAnalysis',
    successorTaskKey: 'coldChainBackend',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc05',
    predecessorTaskKey: 'coldChainBackend',
    successorTaskKey: 'coldChainDashboard',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc06',
    predecessorTaskKey: 'coldChainDashboard',
    successorTaskKey: 'coldChainQa',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc07',
    predecessorTaskKey: 'coldChainQa',
    successorTaskKey: 'coldChainClosure',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc08',
    predecessorTaskKey: 'routeKickoff',
    successorTaskKey: 'routeDataModel',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc09',
    predecessorTaskKey: 'routeDataModel',
    successorTaskKey: 'routeGpsIntegration',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc10',
    predecessorTaskKey: 'routeGpsIntegration',
    successorTaskKey: 'routeAlgorithm',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc11',
    predecessorTaskKey: 'routeAlgorithm',
    successorTaskKey: 'routeDispatchBoard',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc12',
    predecessorTaskKey: 'routeProviderApi',
    successorTaskKey: 'routeMobileQa',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc13',
    predecessorTaskKey: 'routeDispatchBoard',
    successorTaskKey: 'routeMobileQa',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc14',
    predecessorTaskKey: 'routeMobileQa',
    successorTaskKey: 'routePilot',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccc15',
    predecessorTaskKey: 'routePilot',
    successorTaskKey: 'routeClosure',
  },
];

const assignments: DemoAssignment[] = [
  {
    taskKey: 'lastMileDiscovery',
    userKey: 'analyst',
    assignedHours: '60.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'lastMileDiscovery',
    userKey: 'pmOperations',
    assignedHours: '20.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'lastMileGpsIntegration',
    userKey: 'developer',
    assignedHours: '76.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'lastMileGpsIntegration',
    userKey: 'analyst',
    assignedHours: '20.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'lastMileMobileProof',
    userKey: 'qa',
    assignedHours: '30.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'lastMileMobileProof',
    userKey: 'developer',
    assignedHours: '10.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'lastMileClosure',
    userKey: 'pmOperations',
    assignedHours: '130.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'lastMileClosure',
    userKey: 'designer',
    assignedHours: '30.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'coldChainAnalysis',
    userKey: 'finance',
    assignedHours: '45.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'coldChainAnalysis',
    userKey: 'pmPlanning',
    assignedHours: '25.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'coldChainBackend',
    userKey: 'developer',
    assignedHours: '80.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'coldChainBackend',
    userKey: 'finance',
    assignedHours: '40.00',
    isMainResponsible: false,
  },
  { taskKey: 'coldChainDashboard', userKey: 'qa', assignedHours: '70.00', isMainResponsible: true },
  {
    taskKey: 'coldChainDashboard',
    userKey: 'finance',
    assignedHours: '40.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'coldChainQa',
    userKey: 'qa',
    assignedHours: '30.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'coldChainQa',
    userKey: 'analyst',
    assignedHours: '14.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'coldChainClosure',
    userKey: 'developer',
    assignedHours: '60.00',
    isMainResponsible: true,
  },
  { taskKey: 'coldChainClosure', userKey: 'qa', assignedHours: '30.00', isMainResponsible: false },
  { taskKey: 'routeKickoff', userKey: 'analyst', assignedHours: '55.00', isMainResponsible: true },
  {
    taskKey: 'routeKickoff',
    userKey: 'pmPlanning',
    assignedHours: '25.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'routeDataModel',
    userKey: 'developer',
    assignedHours: '110.00',
    isMainResponsible: true,
  },
  { taskKey: 'routeDataModel', userKey: 'analyst', assignedHours: '40.00', isMainResponsible: false },
  {
    taskKey: 'routeGpsIntegration',
    userKey: 'developer',
    assignedHours: '80.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'routeGpsIntegration',
    userKey: 'qa',
    assignedHours: '40.00',
    isMainResponsible: false,
  },
  { taskKey: 'routeProviderApi', userKey: 'qa', assignedHours: '32.00', isMainResponsible: true },
  {
    taskKey: 'routeProviderApi',
    userKey: 'finance',
    assignedHours: '16.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'routeAlgorithm',
    userKey: 'developer',
    assignedHours: '30.00',
    isMainResponsible: true,
  },
  { taskKey: 'routeAlgorithm', userKey: 'analyst', assignedHours: '50.00', isMainResponsible: false },
  { taskKey: 'routeDispatchBoard', userKey: 'designer', assignedHours: '25.00', isMainResponsible: true },
  {
    taskKey: 'routeDispatchBoard',
    userKey: 'pmPlanning',
    assignedHours: '15.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'routeMobileQa',
    userKey: 'designer',
    assignedHours: '40.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'routeMobileQa',
    userKey: 'qa',
    assignedHours: '20.00',
    isMainResponsible: false,
  },
  { taskKey: 'routePilot', userKey: 'pmPlanning', assignedHours: '90.00', isMainResponsible: true },
  {
    taskKey: 'routePilot',
    userKey: 'designer',
    assignedHours: '50.00',
    isMainResponsible: false,
  },
  {
    taskKey: 'routeClosure',
    userKey: 'finance',
    assignedHours: '35.00',
    isMainResponsible: true,
  },
  {
    taskKey: 'routeClosure',
    userKey: 'pmPlanning',
    assignedHours: '15.00',
    isMainResponsible: false,
  },
];

export const demoResources: DemoResource[] = [
  {
    key: 'laptopDev01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
    name: 'Laptop Dell Latitude 5440 - Desarrollo 1',
    description: 'Laptop principal para desarrollo web y pruebas locales.',
    code: 'LAP-DEV-001',
    category: ResourceCategory.LAPTOP,
    serialNumber: 'LS-LAP-2026-001',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes:
      'Caso de conflicto demostrable: intentar asignarla entre 2026-08-01 y 2026-08-05 cruza con una asignacion activa.',
    isActive: true,
  },
  {
    key: 'laptopDev02',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
    name: 'Laptop Lenovo ThinkPad E14 - Desarrollo 2',
    description: 'Laptop para levantamiento funcional y validacion de prototipos.',
    code: 'LAP-DEV-002',
    category: ResourceCategory.LAPTOP,
    serialNumber: 'LS-LAP-2026-002',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'desktopDev01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd03',
    name: 'Computadora HP ProDesk - Desarrollo backend',
    description: 'Equipo de escritorio usado para normalizacion de cronogramas.',
    code: 'DESK-DEV-001',
    category: ResourceCategory.DESKTOP_COMPUTER,
    serialNumber: 'LS-DESK-2026-001',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'testServer',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd04',
    name: 'Servidor de pruebas interno',
    description: 'Servidor para ambientes de pruebas de integracion.',
    code: 'SRV-TEST-001',
    category: ResourceCategory.SERVER,
    serialNumber: 'LS-SRV-2026-001',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'stagingServer',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd05',
    name: 'Servidor de staging',
    description: 'Servidor reservado para despliegues previos a la demostracion.',
    code: 'SRV-STG-001',
    category: ResourceCategory.SERVER,
    serialNumber: 'LS-SRV-2026-002',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'androidPhone01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd06',
    name: 'Telefono Android Samsung A54',
    description: 'Telefono Android para pruebas de compatibilidad.',
    code: 'AND-TEST-001',
    category: ResourceCategory.MOBILE_DEVICE,
    serialNumber: 'LS-AND-2026-001',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'androidPhone02',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd07',
    name: 'Telefono Android Motorola G84',
    description: 'Telefono Android en revision tecnica.',
    code: 'AND-TEST-002',
    category: ResourceCategory.MOBILE_DEVICE,
    serialNumber: 'LS-AND-2026-002',
    operationalStatus: ResourceOperationalStatus.MAINTENANCE,
    notes: 'Mantenimiento preventivo registrado para demostrar el estado operativo.',
    isActive: true,
  },
  {
    key: 'iphoneTest01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd08',
    name: 'iPhone 14 de pruebas',
    description: 'Dispositivo iOS para pruebas de interfaz y compatibilidad.',
    code: 'IPH-TEST-001',
    category: ResourceCategory.MOBILE_DEVICE,
    serialNumber: 'LS-IOS-2026-001',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'tabletTest01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd09',
    name: 'Tablet Samsung Tab S9',
    description: 'Tablet para validar flujos operativos en pantalla tactil.',
    code: 'TAB-TEST-001',
    category: ResourceCategory.TABLET,
    serialNumber: 'LS-TAB-2026-001',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'gpsDevice01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd10',
    name: 'Dispositivo GPS Queclink GV300',
    description: 'Dispositivo GPS usado para pruebas de trazabilidad logistica.',
    code: 'GPS-TRACK-001',
    category: ResourceCategory.OTHER,
    serialNumber: 'LS-GPS-2026-001',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'networkEdge01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd11',
    name: 'Router MikroTik de laboratorio',
    description: 'Equipo de red para pruebas de conectividad y ambientes aislados.',
    code: 'NET-EDGE-001',
    category: ResourceCategory.NETWORK_EQUIPMENT,
    serialNumber: 'LS-NET-2026-001',
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'licenseDesign01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd12',
    name: 'Licencia Figma Professional - Diseno 1',
    description: 'Licencia individual para diseno de prototipos.',
    code: 'LIC-DES-001',
    category: ResourceCategory.SOFTWARE_LICENSE,
    serialNumber: null,
    operationalStatus: ResourceOperationalStatus.OPERATIONAL,
    notes: null,
    isActive: true,
  },
  {
    key: 'licenseQa01',
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddd13',
    name: 'Licencia BrowserStack - QA 1',
    description: 'Licencia de pruebas de compatibilidad para QA.',
    code: 'LIC-QA-001',
    category: ResourceCategory.SOFTWARE_LICENSE,
    serialNumber: null,
    operationalStatus: ResourceOperationalStatus.OUT_OF_SERVICE,
    notes: 'Fuera de servicio para demostrar filtros sin asignaciones activas.',
    isActive: false,
  },
];

export const demoResourceAssignments: DemoResourceAssignment[] = [
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
    resourceKey: 'laptopDev02',
    projectKey: 'lastMile2025',
    taskKey: 'lastMileDiscovery',
    startDate: '2025-09-15',
    endDate: '2025-10-03',
    assignedByKey: 'pmOperations',
    notes: 'Asignacion historica para levantamiento funcional de ultima milla.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
    resourceKey: 'gpsDevice01',
    projectKey: 'lastMile2025',
    taskKey: 'lastMileGpsIntegration',
    startDate: '2025-10-06',
    endDate: '2025-10-31',
    assignedByKey: 'pmOperations',
    notes: 'Dispositivo GPS utilizado para validar trazabilidad de entregas urbanas.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03',
    resourceKey: 'androidPhone01',
    projectKey: 'lastMile2025',
    taskKey: 'lastMileMobileProof',
    startDate: '2025-11-03',
    endDate: '2025-11-28',
    assignedByKey: 'pmOperations',
    notes: 'Telefono usado para pruebas de evidencia movil en campo.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04',
    resourceKey: 'licenseDesign01',
    projectKey: 'lastMile2025',
    taskKey: 'lastMileClosure',
    startDate: '2025-12-01',
    endDate: '2025-12-19',
    assignedByKey: 'pmOperations',
    notes: 'Licencia usada para preparar pantallas de cierre y capacitacion.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05',
    resourceKey: 'testServer',
    projectKey: 'coldChain2026',
    taskKey: 'coldChainBackend',
    startDate: '2026-02-09',
    endDate: '2026-03-27',
    assignedByKey: 'pmPlanning',
    notes: 'Servidor usado para servicios de monitoreo de cadena fria.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee06',
    resourceKey: 'stagingServer',
    projectKey: 'coldChain2026',
    taskKey: 'coldChainDashboard',
    startDate: '2026-03-30',
    endDate: '2026-04-30',
    assignedByKey: 'pmPlanning',
    notes: 'Ambiente de staging para tablero de cadena fria.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee07',
    resourceKey: 'networkEdge01',
    projectKey: 'coldChain2026',
    taskKey: 'coldChainQa',
    startDate: '2026-05-04',
    endDate: '2026-06-05',
    assignedByKey: 'pmPlanning',
    notes: 'Equipo de red para simular conectividad de sensores refrigerados.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee08',
    resourceKey: 'iphoneTest01',
    projectKey: 'coldChain2026',
    taskKey: 'coldChainQa',
    startDate: '2026-05-12',
    endDate: '2026-06-05',
    assignedByKey: 'pmPlanning',
    notes: 'Dispositivo iOS usado para validacion movil del piloto refrigerado.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee09',
    resourceKey: 'tabletTest01',
    projectKey: 'coldChain2026',
    taskKey: 'coldChainClosure',
    startDate: '2026-06-08',
    endDate: '2026-06-26',
    assignedByKey: 'pmPlanning',
    notes: 'Tablet usada para presentar resultados consolidados al equipo operativo.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10',
    resourceKey: 'gpsDevice01',
    projectKey: 'routeOptimizer2026',
    taskKey: 'routeGpsIntegration',
    startDate: '2026-07-25',
    endDate: '2026-07-28',
    assignedByKey: 'pmPlanning',
    notes: 'Asignacion finalizada ayer para demostrar historial sin bloquear disponibilidad futura.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11',
    resourceKey: 'laptopDev01',
    projectKey: 'routeOptimizer2026',
    taskKey: 'routeAlgorithm',
    startDate: '2026-07-29',
    endDate: '2026-09-15',
    assignedByKey: 'pmPlanning',
    notes:
      'Asignacion activa. Intentar usar LAP-DEV-001 entre 2026-08-01 y 2026-08-05 debe mostrar conflicto.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12',
    resourceKey: 'testServer',
    projectKey: 'routeOptimizer2026',
    taskKey: 'routeProviderApi',
    startDate: '2026-07-29',
    endDate: '2026-08-15',
    assignedByKey: 'pmPlanning',
    notes: 'Servidor con asignacion actual; eliminarlo o desactivarlo debe fallar.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee13',
    resourceKey: 'stagingServer',
    projectKey: 'routeOptimizer2026',
    taskKey: 'routeDispatchBoard',
    startDate: '2026-08-10',
    endDate: '2026-10-05',
    assignedByKey: 'pmPlanning',
    notes: 'Asignacion futura para probar bloqueo de eliminacion por reserva programada.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee14',
    resourceKey: 'androidPhone01',
    projectKey: 'routeOptimizer2026',
    taskKey: 'routeMobileQa',
    startDate: '2026-09-20',
    endDate: '2026-11-05',
    assignedByKey: 'pmPlanning',
    notes: 'Telefono reservado para pruebas moviles de campo.',
  },
  {
    uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee15',
    resourceKey: 'licenseDesign01',
    projectKey: 'routeOptimizer2026',
    taskKey: 'routeDispatchBoard',
    startDate: '2026-08-10',
    endDate: '2026-10-05',
    assignedByKey: 'pmPlanning',
    notes: 'Licencia de diseno reservada para prototipos del tablero de despacho.',
  },
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

    validateDemoBudgets();

    await dataSource.transaction(async (entityManager) => {
      const userRepository = entityManager.getRepository(User);
      const projectRepository = entityManager.getRepository(Project);
      const projectMemberRepository = entityManager.getRepository(ProjectMember);
      const taskRepository = entityManager.getRepository(Task);
      const taskAssignmentRepository = entityManager.getRepository(TaskAssignment);
      const taskDependencyRepository = entityManager.getRepository(TaskDependency);
      const resourceRepository = entityManager.getRepository(Resource);
      const resourceAssignmentRepository = entityManager.getRepository(ResourceAssignment);

      const userUuidByKey = await seedUsers(userRepository, passwordHash);
      const projectUuidByKey = await seedProjects(projectRepository, userUuidByKey);
      await seedProjectMembers(projectMemberRepository, userUuidByKey, projectUuidByKey);
      const taskUuidByKey = await seedTasks(taskRepository, projectUuidByKey);
      await seedDependencies(taskDependencyRepository, taskUuidByKey);
      await seedAssignments(taskAssignmentRepository, taskUuidByKey, userUuidByKey);
      const resourceUuidByKey = await seedResources(resourceRepository);
      await seedResourceAssignments(
        resourceAssignmentRepository,
        resourceUuidByKey,
        projectUuidByKey,
        taskUuidByKey,
        userUuidByKey,
      );
    });

    logger.log('Demo data seed completed. It can be run again without duplicating demo records.');
    logger.log(
      `Demo password source: ${process.env.DEMO_SEED_PASSWORD ? 'DEMO_SEED_PASSWORD' : 'local default'}.`,
    );
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

  await softDeleteRetiredDemoProjects(projectRepository);

  return projectUuidByKey;
}

async function softDeleteRetiredDemoProjects(projectRepository: Repository<Project>): Promise<void> {
  if (RETIRED_DEMO_PROJECT_UUIDS.length === 0) {
    return;
  }

  await projectRepository
    .createQueryBuilder()
    .softDelete()
    .where('uuid IN (:...retiredProjectUuids)', {
      retiredProjectUuids: RETIRED_DEMO_PROJECT_UUIDS,
    })
    .execute();
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

export async function seedResources(
  resourceRepository: Repository<Resource>,
): Promise<Map<string, string>> {
  const resourceUuidByKey = new Map<string, string>();

  for (const resource of demoResources) {
    const existingResource = await resourceRepository.findOne({
      where: [{ uuid: resource.uuid }, { code: resource.code }],
      withDeleted: true,
    });
    const resourceEntity = existingResource ?? resourceRepository.create({ uuid: resource.uuid });

    resourceEntity.name = resource.name;
    resourceEntity.description = resource.description;
    resourceEntity.code = resource.code;
    resourceEntity.category = resource.category;
    resourceEntity.serialNumber = resource.serialNumber;
    resourceEntity.operationalStatus = resource.operationalStatus;
    resourceEntity.notes = resource.notes;
    resourceEntity.isActive = resource.isActive;
    resourceEntity.deletedAt = null;

    const savedResource = await resourceRepository.save(resourceEntity);

    resourceUuidByKey.set(resource.key, savedResource.uuid);
  }

  return resourceUuidByKey;
}

export async function seedResourceAssignments(
  resourceAssignmentRepository: Repository<ResourceAssignment>,
  resourceUuidByKey: ReadonlyMap<string, string>,
  projectUuidByKey: ReadonlyMap<string, string>,
  taskUuidByKey: ReadonlyMap<string, string>,
  userUuidByKey: ReadonlyMap<string, string>,
): Promise<void> {
  validateDemoResourceAssignments();

  for (const assignment of demoResourceAssignments) {
    const resourceUuid = getRequiredMapValue(resourceUuidByKey, assignment.resourceKey, 'resource');
    const projectUuid = getRequiredMapValue(projectUuidByKey, assignment.projectKey, 'project');
    const taskUuid =
      assignment.taskKey === null
        ? null
        : getRequiredMapValue(taskUuidByKey, assignment.taskKey, 'task');
    const assignedByUuid = getRequiredMapValue(userUuidByKey, assignment.assignedByKey, 'user');
    const existingAssignment = await resourceAssignmentRepository.findOne({
      where: { uuid: assignment.uuid },
      withDeleted: true,
    });
    const assignmentEntity =
      existingAssignment ?? resourceAssignmentRepository.create({ uuid: assignment.uuid });

    assignmentEntity.resourceUuid = resourceUuid;
    assignmentEntity.projectUuid = projectUuid;
    assignmentEntity.taskUuid = taskUuid;
    assignmentEntity.startDate = assignment.startDate;
    assignmentEntity.endDate = assignment.endDate;
    assignmentEntity.assignedByUuid = assignedByUuid;
    assignmentEntity.notes = assignment.notes;
    assignmentEntity.deletedAt = null;

    await resourceAssignmentRepository.save(assignmentEntity);
  }
}

export function validateDemoResourceAssignments(): void {
  const operationalResourceKeys = new Set(
    demoResources
      .filter(
        (resource) =>
          resource.isActive && resource.operationalStatus === ResourceOperationalStatus.OPERATIONAL,
      )
      .map((resource) => resource.key),
  );
  const assignmentsByResourceKey = new Map<string, DemoResourceAssignment[]>();

  demoResourceAssignments.forEach((assignment) => {
    if (!operationalResourceKeys.has(assignment.resourceKey)) {
      throw new Error(
        `Resource assignment seed uses non operational resource ${assignment.resourceKey}.`,
      );
    }

    const resourceAssignments = assignmentsByResourceKey.get(assignment.resourceKey) ?? [];
    resourceAssignments.push(assignment);
    assignmentsByResourceKey.set(assignment.resourceKey, resourceAssignments);
  });

  assignmentsByResourceKey.forEach((resourceAssignments, resourceKey) => {
    const sortedAssignments = [...resourceAssignments].sort((firstAssignment, secondAssignment) =>
      firstAssignment.startDate.localeCompare(secondAssignment.startDate),
    );

    for (let index = 1; index < sortedAssignments.length; index += 1) {
      const previousAssignment = sortedAssignments[index - 1];
      const currentAssignment = sortedAssignments[index];

      if (
        previousAssignment !== undefined &&
        currentAssignment !== undefined &&
        previousAssignment.startDate <= currentAssignment.endDate &&
        previousAssignment.endDate >= currentAssignment.startDate
      ) {
        throw new Error(`Resource assignment seed overlap detected for ${resourceKey}.`);
      }
    }
  });
}

export function validateDemoBudgets(): void {
  projects.forEach((project) => {
    const projectTasks = tasks.filter((task) => task.projectKey === project.key);
    const approvedBudget = parseMoneyToCents(project.approvedBudget);
    const plannedBudget = sumMoneyToCents(projectTasks.map((task) => task.plannedBudget));
    const actualCost = sumMoneyToCents(projectTasks.map((task) => task.actualCost));

    if (plannedBudget > approvedBudget) {
      throw new Error(
        `Project ${project.key} has planned budget above approved budget in demo seed.`,
      );
    }

    if (actualCost > approvedBudget) {
      throw new Error(`Project ${project.key} has actual cost above approved budget in demo seed.`);
    }

    projectTasks.forEach((task) => {
      if (parseMoneyToCents(task.actualCost) > parseMoneyToCents(task.plannedBudget)) {
        throw new Error(`Task ${task.key} has actual cost above planned budget in demo seed.`);
      }
    });
  });
}

function sumMoneyToCents(values: readonly string[]): number {
  return values.reduce((total, value) => total + parseMoneyToCents(value), 0);
}

function parseMoneyToCents(value: string): number {
  if (!/^\d+\.\d{2}$/.test(value)) {
    throw new Error(`Invalid money value in demo seed: ${value}.`);
  }

  const [units, cents] = value.split('.');

  if (units === undefined || cents === undefined) {
    throw new Error(`Invalid money value in demo seed: ${value}.`);
  }

  return Number.parseInt(units, 10) * 100 + Number.parseInt(cents, 10);
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

if (require.main === module) {
  void bootstrap();
}
