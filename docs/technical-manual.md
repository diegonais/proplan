# Manual tecnico de PROPLAN

## Objetivo

Este manual describe la estructura tecnica necesaria para levantar, mantener y demostrar PROPLAN en entorno local academico. No reemplaza la documentacion universitaria ni modifica su cronograma tentativo.

## Arquitectura cliente-servidor

PROPLAN separa responsabilidades:

- Cliente React: interfaz, navegacion, formularios, visualizacion de proyectos, actividades, Gantt, reportes y consumo de API.
- Servidor NestJS: autenticacion, autorizacion, validaciones, reglas de negocio, persistencia y exportaciones.
- PostgreSQL: almacenamiento transaccional de usuarios, proyectos, miembros, actividades, dependencias y asignaciones.

La API se publica bajo `http://localhost:3000/api/v1` y el frontend bajo `http://localhost:5173`.

## Estructura backend

```text
backend/src/
  app.module.ts
  main.ts
  common/
    decorators/
    enums/
    filters/
    guards/
    interfaces/
    utils/
  config/
  database/
    data-source.ts
    migrations/
    seeds/
  health/
  modules/
    auth/
    users/
    projects/
    project-members/
    tasks/
    task-assignments/
    task-dependencies/
    finances/
    reports/
```

Los controladores reciben solicitudes y delegan en servicios. Las reglas de negocio viven en servicios y calculos de dominio, no en controladores. Las entidades TypeORM representan tablas y restricciones de base.

## Estructura frontend

```text
frontend/src/
  app/
    providers/
    router/
    theme/
  components/
    feedback/
    navigation/
  features/
    auth/
    dashboard/
    errors/
    pending/
    projects/
    reports/
    tasks/
    team/
  layouts/
  services/
  test/
  utils/
```

El frontend centraliza la configuracion de API en `src/utils/env.ts` y el cliente HTTP en `src/services/http/httpClient.ts`. Los textos visibles estan en espanol y la interfaz sigue Material Design con Material UI.

## Base de datos

PostgreSQL es la base oficial. TypeORM se usa con `synchronize: false`; los cambios estructurales deben pasar por migraciones.

Entidades principales:

- `User`
- `Project`
- `ProjectMember`
- `Task`
- `TaskAssignment`
- `TaskDependency`

Todas usan UUID como identificador primario. Los montos se almacenan como `numeric`, no como `float`.

## Migraciones

Ejecutar:

```powershell
cd backend
npm run migration:run
```

Crear o generar migraciones:

```powershell
npm run migration:create -- src/database/migrations/NombreDeMigracion
npm run migration:generate -- src/database/migrations/NombreDeMigracion
```

Revertir la ultima migracion:

```powershell
npm run migration:revert
```

## Seeds

Seed minimo:

```powershell
npm run seed:initial-admin
```

Seed demo:

```powershell
npm run seed:demo
```

El seed demo no corre en produccion, usa datos ficticios, UUID fijos y password local documentado. Se puede repetir sin duplicar registros.

## Variables

Variables backend requeridas:

- `NODE_ENV`
- `APP_PORT`
- `API_PREFIX`
- `API_VERSION`
- `TIME_ZONE`
- `CORS_ORIGINS`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BCRYPT_SALT_ROUNDS`
- `THROTTLE_TTL_SECONDS`
- `THROTTLE_LIMIT`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`

Variables de seed:

- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_NAME`
- `INITIAL_ADMIN_PASSWORD`
- `DEMO_SEED_PASSWORD`

Variables frontend:

- `VITE_API_BASE_URL`
- `VITE_TIME_ZONE`

## Seguridad

- Autenticacion con JWT.
- Passwords con bcrypt.
- Guards `JwtAuthGuard` y `RolesGuard`.
- Validacion global con `ValidationPipe`, `whitelist` y `forbidNonWhitelisted`.
- Helmet en backend.
- Throttling en login.
- No se expone `passwordHash` en DTO de respuesta.
- Los permisos visuales del frontend no sustituyen los guards del backend.

Roles:

- `ADMIN`
- `PROJECT_MANAGER`
- `USER`

## Fechas

Politica oficial:

- Zona funcional: `America/La_Paz`.
- Fechas de planificacion: `date` y formato `YYYY-MM-DD`.
- Instantes tecnicos: `timestamptz`.
- Persistencia de instantes: UTC.
- Presentacion: conversion en frontend a `America/La_Paz`.
- No ajustar horas manualmente.

## Despliegue local

1. Crear `.env`.
2. Levantar PostgreSQL:

```powershell
docker compose up -d
```

3. Instalar dependencias.
4. Ejecutar migraciones.
5. Ejecutar seed demo.
6. Iniciar backend.
7. Iniciar frontend.
8. Abrir `http://localhost:5173`.

## Pruebas

Backend:

```powershell
cd backend
npm run lint
npm run test
npm run build
```

Frontend:

```powershell
cd frontend
npm run lint
npm run test
npm run build
```

La validacion manual de demo debe cubrir login por rol, dashboard, proyectos, actividades, Gantt, reportes, presupuesto y exportaciones.
