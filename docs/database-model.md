# Modelo de base de datos de PROPLAN

## Principios

- PostgreSQL es la base de datos oficial.
- TypeORM es el ORM oficial.
- Todas las claves primarias son UUID.
- No se usan identificadores numericos autoincrementales.
- Las claves foraneas terminan en `Uuid`.
- Los montos usan `numeric` con escala decimal.
- Fechas de planificacion usan `date`.
- Instantes tecnicos usan `timestamptz`.
- Proyectos, actividades, recursos y asignaciones de recursos soportan eliminacion logica mediante `deletedAt`.
- No se agregan entidades fuera del alcance aprobado.

## Entidades

### User

Tabla: `users`

Campos:

- `uuid`: UUID, clave primaria.
- `name`: nombre visible.
- `email`: email normalizado en minusculas, unico.
- `passwordHash`: hash bcrypt.
- `role`: `ADMIN`, `PROJECT_MANAGER`, `USER`.
- `isActive`: estado de usuario.
- `createdAt`: `timestamptz`.
- `updatedAt`: `timestamptz`.

Restricciones:

- Email unico.
- Email en minusculas.
- No se expone `passwordHash` en respuestas.

### Project

Tabla: `projects`

Campos:

- `uuid`: UUID, clave primaria.
- `name`: nombre.
- `description`: descripcion opcional.
- `objective`: objetivo.
- `startDate`: `date`.
- `endDate`: `date`.
- `status`: `PLANNING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- `approvedBudget`: `numeric(12,2)`.
- `managerUuid`: UUID del jefe de proyecto.
- `createdAt`: `timestamptz`.
- `updatedAt`: `timestamptz`.
- `deletedAt`: `timestamptz`, eliminacion logica.

Restricciones:

- `endDate >= startDate`.
- `approvedBudget >= 0`.
- `managerUuid` referencia `users.uuid`.

### ProjectMember

Tabla: `project_members`

Campos:

- `uuid`: UUID, clave primaria.
- `projectUuid`: UUID del proyecto.
- `userUuid`: UUID del usuario.
- `joinedAt`: `timestamptz`.

Restricciones:

- Unica combinacion `projectUuid + userUuid`.
- `projectUuid` referencia `projects.uuid`.
- `userUuid` referencia `users.uuid`.

Regla de dominio:

- Un usuario debe ser miembro del proyecto antes de ser asignado a una actividad.

### Task

Tabla: `tasks`

En interfaz se muestra como Actividad.

Campos:

- `uuid`: UUID, clave primaria.
- `projectUuid`: UUID del proyecto.
- `parentTaskUuid`: UUID opcional de actividad padre.
- `name`: nombre.
- `description`: descripcion opcional.
- `startDate`: `date`.
- `endDate`: `date`.
- `status`: `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`.
- `progress`: entero de 0 a 100.
- `estimatedHours`: `numeric(10,2)`.
- `plannedBudget`: `numeric(12,2)`.
- `actualCost`: `numeric(12,2)`.
- `createdAt`: `timestamptz`.
- `updatedAt`: `timestamptz`.
- `deletedAt`: `timestamptz`, eliminacion logica.

Restricciones:

- `endDate >= startDate`.
- `progress` entre 0 y 100.
- Horas, presupuesto y costo no negativos.
- `actualCost <= plannedBudget`.
- `COMPLETED` exige progreso 100.
- `projectUuid` referencia `projects.uuid`.
- `parentTaskUuid` referencia `tasks.uuid`.

Reglas de dominio:

- La actividad pertenece a un proyecto.
- La subactividad pertenece al mismo proyecto que su padre.
- La subactividad debe quedar dentro del rango de fechas de la actividad padre.

### TaskAssignment

Tabla: `task_assignments`

Campos:

- `uuid`: UUID, clave primaria.
- `taskUuid`: UUID de actividad.
- `userUuid`: UUID de usuario.
- `assignedHours`: `numeric(10,2)`.
- `isMainResponsible`: booleano.

Restricciones:

- `assignedHours >= 0`.
- Unica combinacion `taskUuid + userUuid`.
- Unico responsable principal por actividad mediante indice parcial.
- `taskUuid` referencia `tasks.uuid`.
- `userUuid` referencia `users.uuid`.

Reglas de dominio:

- El usuario asignado debe ser miembro del proyecto.
- El responsable principal debe estar asignado.
- La reasignacion principal se hace en transaccion.

### TaskDependency

Tabla: `task_dependencies`

Campos:

- `uuid`: UUID, clave primaria.
- `predecessorTaskUuid`: UUID de actividad predecesora.
- `successorTaskUuid`: UUID de actividad sucesora.
- `dependencyType`: `FINISH_TO_START`.

Restricciones:

- Una actividad no puede depender de si misma.
- Unica combinacion `predecessorTaskUuid + successorTaskUuid + dependencyType`.
- Ambas columnas referencian `tasks.uuid`.

Reglas de dominio:

- No se permiten ciclos.
- Las actividades deben pertenecer al mismo proyecto.
- La sucesora no inicia antes de que termine la predecesora.

### Resource

Tabla: `resources`

Campos:

- `uuid`: UUID, clave primaria.
- `name`: nombre visible.
- `description`: descripcion opcional.
- `code`: codigo interno unico.
- `category`: categoria del recurso.
- `serialNumber`: numero de serie opcional.
- `operationalStatus`: `OPERATIONAL`, `MAINTENANCE`, `OUT_OF_SERVICE`.
- `notes`: notas opcionales.
- `isActive`: estado activo del catalogo.
- `createdAt`: `timestamptz`.
- `updatedAt`: `timestamptz`.
- `deletedAt`: `timestamptz`, eliminacion logica.

Categorias:

- `DESKTOP_COMPUTER`
- `LAPTOP`
- `SERVER`
- `MOBILE_DEVICE`
- `TABLET`
- `PERIPHERAL`
- `NETWORK_EQUIPMENT`
- `SOFTWARE_LICENSE`
- `CLOUD_SERVICE`
- `OTHER`

Restricciones:

- `code` unico.
- La disponibilidad no se guarda como campo; se calcula desde estado operativo y asignaciones.

### ResourceAssignment

Tabla: `resource_assignments`

Campos:

- `uuid`: UUID, clave primaria.
- `resourceUuid`: UUID del recurso.
- `projectUuid`: UUID del proyecto.
- `taskUuid`: UUID opcional de actividad.
- `startDate`: `date`.
- `endDate`: `date`.
- `assignedByUuid`: UUID del usuario que asigna.
- `notes`: notas opcionales.
- `createdAt`: `timestamptz`.
- `updatedAt`: `timestamptz`.
- `deletedAt`: `timestamptz`, eliminacion logica.

Restricciones:

- `endDate >= startDate`.
- `resourceUuid` referencia `resources.uuid`.
- `projectUuid` referencia `projects.uuid`.
- `taskUuid` referencia `tasks.uuid` cuando existe.
- `assignedByUuid` referencia `users.uuid`.
- Restriccion de exclusion PostgreSQL para impedir rangos superpuestos activos por recurso.

Reglas de dominio:

- Toda asignacion pertenece a un proyecto.
- La actividad opcional debe pertenecer al mismo proyecto.
- Las fechas deben estar dentro del proyecto y, si corresponde, de la actividad.
- Solo se asignan recursos activos, no eliminados y en estado `OPERATIONAL`.

## Relaciones

- `User` dirige muchos `Project` por `Project.managerUuid`.
- `Project` tiene muchos `ProjectMember`.
- `User` participa en muchos `Project` mediante `ProjectMember`.
- `Project` tiene muchas `Task`.
- `Task` puede tener muchas subactividades mediante `parentTaskUuid`.
- `Task` tiene muchas `TaskAssignment`.
- `User` tiene muchas `TaskAssignment`.
- `Task` se relaciona con otras `Task` mediante `TaskDependency`.
- `Resource` tiene muchas `ResourceAssignment`.
- `Project` tiene muchas `ResourceAssignment`.
- `Task` puede tener muchas `ResourceAssignment`.
- `User` registra muchas `ResourceAssignment` mediante `assignedByUuid`.

## Eliminacion logica

- `Project.deletedAt` permite conservar trazabilidad.
- `Task.deletedAt` permite conservar trazabilidad.
- `Resource.deletedAt` permite conservar trazabilidad del catalogo.
- `ResourceAssignment.deletedAt` conserva historial de uso.
- Los listados normales deben excluir eliminados.
- `isActive` se usa para usuarios y recursos, pero no reemplaza `deletedAt`.

## Fechas

- `startDate` y `endDate`: `date`, sin hora.
- `createdAt`, `updatedAt`, `deletedAt`, `joinedAt`: `timestamptz`.
- Instantes persistidos en UTC.
- Presentacion en `America/La_Paz`.

## Montos

- `Project.approvedBudget`: presupuesto aprobado.
- `Task.plannedBudget`: presupuesto planificado.
- `Task.actualCost`: costo ejecutado.
- No existe entidad de gastos en esta version.
- No usar `float`.

## Semaforo

El semaforo se calcula desde datos existentes:

- Verde: sin atrasos importantes, consumo menor a 80% y proyecto no vencido.
- Amarillo: consumo entre 80% y 100% o alguna actividad vencida bajo el umbral rojo.
- Rojo: costo ejecutado supera presupuesto, proyecto vencido o al menos 30% de actividades activas vencidas.
