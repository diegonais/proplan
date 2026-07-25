# PROPLAN

PROPLAN es un sistema web de gestion y planificacion de proyectos. Permite administrar usuarios, proyectos, actividades, subactividades, dependencias, miembros, asignaciones, responsables principales, horas, presupuesto, costos ejecutados, reportes, Gantt y exportaciones.

El proyecto esta preparado para una demostracion academica local con PostgreSQL, API NestJS, frontend React y datos ficticios idempotentes.

## Arquitectura

PROPLAN usa una arquitectura cliente-servidor:

- Frontend: aplicacion React con TypeScript y Material UI.
- Backend: API REST NestJS con TypeScript, Swagger, JWT, guards por rol y TypeORM.
- Base de datos: PostgreSQL con migraciones, UUID y eliminacion logica en proyectos y actividades.
- Comunicacion: JSON sobre HTTP bajo el prefijo `http://localhost:3000/api/v1`.

Estructura principal:

```text
proplan/
  backend/    API NestJS, TypeORM, modulos de dominio, migraciones y seeds
  frontend/   React, Vite, Material UI, rutas y consumo de API
  docs/       Manuales tecnicos, usuario, API, pruebas y modelo de datos
```

`AGENTS.md` y `docs/organizacion.md` o `docs/organización.md`, segun el nombre existente en el entorno, son la fuente de reglas del proyecto. No modificar el cronograma tentativo universitario para preparar la demo.

## Stack

| Area | Tecnologia |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| UI | Material UI |
| Backend | NestJS 11, TypeScript |
| Base de datos | PostgreSQL 16 |
| ORM | TypeORM |
| Seguridad | JWT, Passport, bcrypt, Helmet, throttling |
| API docs | Swagger |
| Reportes | PDFKit y ExcelJS |
| Pruebas | Jest, Vitest, Testing Library |
| Contenedores | Docker Compose para PostgreSQL |

## Requisitos

- Node.js 24 o superior.
- npm 11 o superior.
- Docker Desktop o Docker Engine con Docker Compose.
- Git.
- Puertos disponibles: `5432`, `3000` y `5173`.

## Variables de entorno

Crear `.env` en la raiz a partir de `.env.example`:

```powershell
Copy-Item .env.example .env
```

Variables principales:

| Variable | Uso |
| --- | --- |
| `NODE_ENV` | `development`, `test` o `production`. |
| `APP_PORT` | Puerto del backend. Por defecto `3000`. |
| `API_PREFIX` | Prefijo global. Por defecto `api`. |
| `API_VERSION` | Version URI. Por defecto `1`. |
| `TIME_ZONE` | Debe ser `America/La_Paz`. |
| `CORS_ORIGINS` | Origenes permitidos del frontend. |
| `JWT_SECRET` | Secreto JWT local. No usar valores reales compartidos. |
| `JWT_EXPIRES_IN` | Duracion del token. |
| `BCRYPT_SALT_ROUNDS` | Rondas de hash, entre 10 y 14. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | Conexion PostgreSQL. |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD` | Seed minimo de administrador. |
| `DEMO_SEED_PASSWORD` | Password local para todos los usuarios ficticios del seed demo. |

El frontend puede usar `frontend/.env`:

```text
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_TIME_ZONE=America/La_Paz
```

No subir archivos `.env` ni credenciales reales.

## PostgreSQL con Docker Compose

Levantar PostgreSQL:

```powershell
docker compose up -d
docker compose ps
```

Ver logs:

```powershell
docker compose logs -f proplan-postgres
```

Detener sin destruir datos:

```powershell
docker compose stop
```

Reiniciar:

```powershell
docker compose restart proplan-postgres
```

El volumen persistente es `proplan_postgres_data`. No ejecutar `docker compose down -v` salvo que se quiera eliminar la base local deliberadamente.

El servicio tiene healthcheck con `pg_isready` y usa `TZ=UTC`/`PGTZ=UTC`; PROPLAN convierte fechas de presentacion con la politica `America/La_Paz`.

## Instalacion

Instalar dependencias:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

## Migraciones

El backend usa `synchronize: false`. Ejecutar migraciones antes de sembrar datos:

```powershell
cd backend
npm run migration:run
```

Comandos disponibles:

```powershell
npm run migration:create -- src/database/migrations/NombreDeMigracion
npm run migration:generate -- src/database/migrations/NombreDeMigracion
npm run migration:run
npm run migration:revert
```

## Seeds

Seed minimo de administrador:

```powershell
cd backend
npm run seed:initial-admin
```

Seed completo de demostracion local:

```powershell
cd backend
npm run seed:demo
```

El seed demo:

- Es idempotente.
- Usa datos ficticios.
- Crea 1 Administrador, 2 Jefes de proyecto y varios Usuarios.
- Crea proyectos en estados `PLANNING`, `IN_PROGRESS` y `COMPLETED`.
- Incluye actividades, subactividades, dependencias `FINISH_TO_START`, miembros, asignaciones, responsable principal, horas, presupuestos y costos.
- Incluye escenarios verde, amarillo y rojo para reportes.
- No se ejecuta en `NODE_ENV=production`.

Credenciales de demostracion local:

| Rol | Email |
| --- | --- |
| Administrador | `admin@proplan.local` |
| Jefe de proyecto | `laura.mamani@proplan.local` |
| Jefe de proyecto | `carlos.quispe@proplan.local` |
| Usuario | `ana.choque@proplan.local` |
| Usuario | `roberto.vargas@proplan.local` |
| Usuario | `maria.flores@proplan.local` |
| Usuario | `diego.rivera@proplan.local` |
| Usuario | `sofia.nunez@proplan.local` |

Password por defecto: `ProplanDemo2026!`

Para cambiarlo localmente:

```text
DEMO_SEED_PASSWORD=OtraClaveLocalSegura
```

Estos usuarios son solo para demostracion local. No usar datos reales.

## Backend

Iniciar API en modo desarrollo:

```powershell
cd backend
npm run start:dev
```

URLs:

- Healthcheck: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/api/docs`

## Frontend

Iniciar Vite:

```powershell
cd frontend
npm run dev
```

Aplicacion:

- `http://localhost:5173`

## Pruebas

Backend:

```powershell
cd backend
npm run lint
npm run test
```

Frontend:

```powershell
cd frontend
npm run lint
npm run test
```

Ver detalle en `docs/testing.md`.

## Build

Backend:

```powershell
cd backend
npm run build
```

Frontend:

```powershell
cd frontend
npm run build
```

## Swagger

Swagger queda disponible en:

```text
http://localhost:3000/api/docs
```

Usar `POST /api/v1/auth/login` para obtener el token y luego autorizar con Bearer token en Swagger.

## Politica UUID

- Todas las entidades de dominio usan `uuid` como clave primaria.
- Las claves foraneas usan nombres explicitos: `projectUuid`, `userUuid`, `taskUuid`, `managerUuid`, `parentTaskUuid`, `predecessorTaskUuid`, `successorTaskUuid`.
- Las rutas reciben parametros descriptivos como `:uuid`, `:projectUuid` o `:taskUuid`.
- El backend valida UUID con `ParseUUIDPipe` o validadores equivalentes.
- No se usan identificadores numericos autoincrementales.
- Los UUID fijos del seed demo existen solo para garantizar idempotencia local.

## Politica de fechas y zona horaria

- Zona oficial: `America/La_Paz`.
- Fechas de planificacion: tipo PostgreSQL `date`, formato `YYYY-MM-DD`, sin hora.
- Instantes tecnicos: `timestamptz`, persistidos en UTC.
- La API expone instantes en ISO 8601.
- El frontend convierte instantes tecnicos a `America/La_Paz` para presentacion.
- No sumar ni restar cuatro horas manualmente.

## Solucion de errores comunes

| Problema | Revision |
| --- | --- |
| `ECONNREFUSED` al iniciar backend | Verificar `docker compose ps` y que PostgreSQL este healthy. |
| Error de autenticacion en seed | Revisar `DB_USERNAME`, `DB_PASSWORD` y migraciones aplicadas. |
| `JWT_SECRET is required` | Completar `.env` desde `.env.example`. |
| Swagger abre pero endpoints devuelven 401 | Ejecutar login y configurar Bearer token. |
| Puerto 5432 ocupado | Cambiar `DB_PORT` en `.env` o detener el PostgreSQL local existente. |
| Seed demo duplica datos | El seed oficial usa UUID fijos; si se editaron manualmente claves o se importaron datos externos, limpiar solo la base local de demo con cuidado. |
| Frontend no consume API | Revisar `VITE_API_BASE_URL` y `CORS_ORIGINS`. |

## Documentacion adicional

- `docs/technical-manual.md`
- `docs/user-manual.md`
- `docs/testing.md`
- `docs/api-overview.md`
- `docs/database-model.md`
- `docs/third-party-licenses.md`
