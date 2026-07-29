# PROPLAN

PROPLAN es un sistema web interno de LogistiSoft para gestionar y planificar proyectos de desarrollo de software orientados a logistica y transporte. Permite administrar usuarios, proyectos, actividades, subactividades, dependencias, miembros, asignaciones humanas, recursos no humanos, responsables principales, horas, presupuesto, costos ejecutados, reportes, Gantt y exportaciones.

El proyecto esta preparado para una demostracion academica local con PostgreSQL, API NestJS, frontend React y datos ficticios idempotentes.

## Arquitectura

PROPLAN usa una arquitectura cliente-servidor:

- Frontend: aplicacion React con TypeScript y Material UI.
- Backend: API REST NestJS con TypeScript, Swagger, JWT, guards por rol y TypeORM.
- Base de datos: PostgreSQL con migraciones, UUID y eliminacion logica en proyectos, actividades, recursos y asignaciones de recursos.
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

## Guia rapida para levantar el proyecto

Los comandos estan escritos para `cmd.exe` desde la raiz del repositorio. Abrir Simbolo del sistema y ubicarse en la carpeta del proyecto:

```cmd
cd proplan
```

### 1. Crear variables de entorno

Crear el archivo `.env` de backend/base de datos desde el ejemplo:

```cmd
copy .env.example .env
```

Para una demo local, los valores de `.env.example` ya sirven como base. Revisar especialmente:

```text
TIME_ZONE=America/La_Paz
CORS_ORIGINS=http://localhost:5173
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proplan
DB_USERNAME=proplan_app
DB_PASSWORD=change_me_for_local_development
DEMO_SEED_PASSWORD=ProplanDemo2026!
```

Crear el archivo `frontend/.env`:

```cmd
(
  echo VITE_API_BASE_URL=http://localhost:3000/api/v1
  echo VITE_TIME_ZONE=America/La_Paz
) > frontend\.env
```

No subir archivos `.env` ni credenciales reales.

### 2. Instalar dependencias

Backend:

```cmd
cd backend
npm ci
```

Frontend:

```cmd
cd ..\frontend
npm ci
```

Volver a la raiz:

```cmd
cd ..
```

### 3. Levantar PostgreSQL

```cmd
docker compose up -d
docker compose ps
```

Esperar a que el servicio `proplan-postgres` aparezca como `healthy`.

Para ver logs de la base de datos:

```cmd
docker compose logs -f proplan-postgres
```

### 4. Ejecutar migraciones

```cmd
cd backend
npm run migration:run
```

El backend usa `synchronize: false`, por eso las migraciones son obligatorias antes de sembrar datos o iniciar la API.

### 5. Cargar datos de demostracion

Ejecutar el seed completo:

```cmd
npm run seed:demo
```

El seed demo es idempotente: se puede ejecutar mas de una vez sin duplicar los registros oficiales de demo.

Tambien existe un seed minimo de administrador:

```cmd
npm run seed:initial-admin
```

Para la presentacion se recomienda usar `seed:demo`, porque crea usuarios, proyectos, actividades, subactividades, dependencias, equipo, asignaciones humanas, recursos de LogistiSoft, asignaciones de recursos activas, programadas y finalizadas, responsables principales, horas, presupuestos, costos y escenarios de semaforo. El seed incluye el caso demostrable de conflicto de `LAP-DEV-001` entre `2026-08-01` y `2026-08-05`, sin insertar datos invalidos.

### 6. Iniciar el backend

Abrir una terminal nueva en la raiz del proyecto:

```cmd
cd backend
npm run start:dev
```

Verificar:

- Healthcheck: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/api/docs`

### 7. Iniciar el frontend

Abrir otra terminal nueva:

```cmd
cd frontend
npm run dev
```

Abrir la aplicacion:

```text
http://localhost:5173
```

### 8. Iniciar sesion

Credenciales de demostracion local:

| Rol | Email | Password |
| --- | --- | --- |
| Administrador | `admin@proplan.local` | `ProplanDemo2026!` |
| Jefe de proyecto | `laura.mamani@proplan.local` | `ProplanDemo2026!` |
| Jefe de proyecto | `carlos.quispe@proplan.local` | `ProplanDemo2026!` |
| Usuario | `ana.choque@proplan.local` | `ProplanDemo2026!` |
| Usuario | `roberto.vargas@proplan.local` | `ProplanDemo2026!` |
| Usuario | `maria.flores@proplan.local` | `ProplanDemo2026!` |
| Usuario | `diego.rivera@proplan.local` | `ProplanDemo2026!` |
| Usuario | `sofia.nunez@proplan.local` | `ProplanDemo2026!` |

Estos usuarios son solo para demostracion local. No usar datos reales.

## Comandos utiles

### Detener servicios locales

Detener PostgreSQL sin borrar datos:

```cmd
docker compose stop
```

Reiniciar PostgreSQL:

```cmd
docker compose restart proplan-postgres
```

Eliminar la base local completa y empezar desde cero:

```cmd
docker compose down -v
docker compose up -d
cd backend
npm run migration:run
npm run seed:demo
```

Usar `docker compose down -v` solo cuando se quiera borrar deliberadamente el volumen local `proplan_postgres_data`.

### Validar calidad antes de entregar

Backend:

```cmd
cd backend
npm run lint
npm test
npm test -- --coverage --runInBand
npm run build
```

Frontend:

```cmd
cd frontend
npm run lint
npm test
npm test -- --coverage
npm run build
```

### Migraciones disponibles

```cmd
cd backend
npm run migration:create -- src/database/migrations/NombreDeMigracion
npm run migration:generate -- src/database/migrations/NombreDeMigracion
npm run migration:run
npm run migration:revert
```

Ver detalle de pruebas en `docs/testing.md`.

## Swagger

Swagger queda disponible en:

```text
http://localhost:3000/api/docs
```

Usar `POST /api/v1/auth/login` para obtener el token y luego autorizar con Bearer token en Swagger.

## Exportaciones

Los reportes exportables de proyecto incluyen datos autorizados del proyecto, actividades, equipo, dependencias, presupuesto y recursos asignados. El PDF contiene la seccion "Recursos asignados" con codigo, nombre, categoria, estado operativo, proyecto, actividad opcional, fecha inicial, fecha final y estado temporal. El Excel agrega hojas "Recursos" y "Asignaciones de recursos"; los textos se sanitizan para evitar inyeccion de formulas y no se exponen campos sensibles como `passwordHash`.

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
