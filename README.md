# PROPLAN

PROPLAN es un sistema web para la planificacion y gestion de proyectos tecnologicos. Esta etapa solo prepara la base tecnica del proyecto; no incluye modulos funcionales de negocio.

## Requisitos previos

- Node.js 24 o superior.
- npm 11 o superior.
- Docker y Docker Compose.
- PostgreSQL se ejecuta localmente mediante Docker Compose.

## Estructura

```text
proplan/
  backend/    API NestJS con TypeORM y PostgreSQL
  frontend/   Aplicacion React con Vite y Material UI
  docs/       Documentacion del proyecto
```

`AGENTS.md` y `docs/organización.md` son la fuente principal de verdad del proyecto.

## Variables de entorno

Crear un archivo `.env` en la raiz a partir de `.env.example`:

```bash
cp .env.example .env
```

No usar credenciales reales en desarrollo local ni subir archivos `.env` al repositorio.

El frontend usa variables de Vite. Crear `frontend/.env` a partir de `frontend/.env.example` cuando sea necesario.

## PostgreSQL

```bash
docker compose up -d
docker compose ps
```

El servicio disponible es `proplan-postgres` y usa un volumen persistente llamado `proplan_postgres_data`.

## Backend

```bash
cd backend
npm install
npm run start:dev
```

La API queda disponible en `http://localhost:3000/api/v1/health`.

Swagger queda disponible en `http://localhost:3000/api/docs`.

### Usuario inicial de desarrollo

Para crear el primer Administrador de forma idempotente en desarrollo, configurar en `.env`:

```bash
INITIAL_ADMIN_EMAIL=admin@proplan.local
INITIAL_ADMIN_NAME=Administrador PROPLAN
INITIAL_ADMIN_PASSWORD=change_me_for_local_development
```

Luego ejecutar:

```bash
cd backend
npm run seed:initial-admin
```

El seed no duplica el usuario si el email ya existe y no debe ejecutarse en produccion.

### Cierre de sesion

Esta fase usa JWT sin persistencia de sesiones ni refresh tokens. Por ello, el cierre de sesion consiste en eliminar el token almacenado por el cliente de forma segura.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

La aplicacion queda disponible en `http://localhost:5173`.

## Calidad

Backend:

```bash
cd backend
npm run lint
npm run test
npm run build
```

Frontend:

```bash
cd frontend
npm run lint
npm run test
npm run build
```

## Migraciones

El backend usa TypeORM con `synchronize: false`. Los cambios de base de datos deben pasar por migraciones.

```bash
cd backend
npm run migration:create -- src/database/migrations/NombreDeMigracion
npm run migration:generate -- src/database/migrations/NombreDeMigracion
npm run migration:run
npm run migration:revert
```

## Politica de UUID

No se deben usar identificadores numericos autoincrementales. Las entidades futuras deberan usar UUID como identificador primario.

## Fechas y zona horaria

- La zona horaria funcional del sistema es `America/La_Paz`.
- Instantes tecnicos como `createdAt`, `updatedAt`, inicio de sesion y eventos del sistema se almacenaran como `timestamptz`.
- Los instantes se conservaran en UTC en PostgreSQL y se convertiran a `America/La_Paz` solo para presentacion.
- Fechas funcionales sin hora se manejaran como `date` en PostgreSQL.
- Las fechas `date` se intercambiaran como cadenas `YYYY-MM-DD`.
- No realizar ajustes manuales sumando o restando horas.

## Exportaciones PDF y Excel

Los reportes completos de proyecto se generan desde el backend mediante:

- `GET /api/v1/projects/:projectUuid/exports/pdf`
- `GET /api/v1/projects/:projectUuid/exports/excel`

Permisos:

- Administrador: puede exportar cualquier proyecto.
- Jefe de proyecto: puede exportar solamente proyectos donde sea responsable.
- Usuario: no puede exportar reportes completos ni informacion financiera.

Controles aplicados:

- El UUID del proyecto se valida con `ParseUUIDPipe`.
- El proyecto debe existir y no estar eliminado logicamente.
- El backend calcula semaforo, progreso, dependencias, asignaciones y resumen financiero.
- El nombre de archivo se normaliza a caracteres seguros e incluye un segmento del UUID.
- La respuesta configura `Content-Type`, `Content-Disposition` y `Content-Length`.
- Los archivos se generan en memoria y no se escriben temporales.
- Los valores de Excel que comienzan con `=`, `+`, `-` o `@` se prefijan con apostrofo para evitar inyeccion de formulas.
- No se exportan `passwordHash`, tokens ni campos internos sensibles.
- Las fechas de planificacion `YYYY-MM-DD` se mantienen sin conversion.
- Los timestamps de generacion se muestran en `America/La_Paz`.

Librerias utilizadas:

| Libreria | Version instalada | Uso | Licencia |
| --- | --- | --- | --- |
| `pdfkit` | 0.19.1 | Generacion de PDF en memoria | MIT |
| `exceljs` | 4.4.0 | Generacion de libros `.xlsx` en memoria | MIT |

No se implementan plantillas complejas, firmas digitales, facturacion, envio por correo ni almacenamiento documental.
