# Licencias de terceros

Este documento resume dependencias relevantes para la demostracion academica local de PROPLAN. Antes de una entrega formal, verificar versiones exactas con `npm ls` y los archivos `package-lock.json`.

## Backend

| Paquete | Uso | Licencia declarada habitual |
| --- | --- | --- |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | Framework backend | MIT |
| `@nestjs/config` | Configuracion por entorno | MIT |
| `@nestjs/jwt`, `@nestjs/passport` | Autenticacion JWT | MIT |
| `@nestjs/swagger` | Documentacion Swagger | MIT |
| `@nestjs/throttler` | Limitacion de peticiones | MIT |
| `typeorm` | ORM | MIT |
| `pg` | Cliente PostgreSQL | MIT |
| `bcrypt` | Hash de passwords | MIT |
| `class-validator`, `class-transformer` | Validacion y transformacion DTO | MIT |
| `helmet` | Cabeceras de seguridad | MIT |
| `passport`, `passport-jwt` | Estrategias de autenticacion | MIT |
| `pdfkit` | Exportacion PDF | MIT |
| `exceljs` | Exportacion Excel | MIT |
| `rxjs` | Utilidades reactivas usadas por NestJS | Apache-2.0 |
| `swagger-ui-express` | UI de Swagger | MIT |

## Frontend

| Paquete | Uso | Licencia declarada habitual |
| --- | --- | --- |
| `react`, `react-dom` | UI frontend | MIT |
| `react-router-dom` | Rutas | MIT |
| `@mui/material`, `@mui/icons-material` | Componentes Material Design | MIT |
| `@emotion/react`, `@emotion/styled` | Estilos requeridos por MUI | MIT |
| `axios` | Cliente HTTP | MIT |
| `vite` | Servidor y build frontend | MIT |

## Herramientas de desarrollo

| Paquete | Uso | Licencia declarada habitual |
| --- | --- | --- |
| `typescript` | Tipado y compilacion | Apache-2.0 |
| `eslint` | Lint | MIT |
| `prettier` | Formato | MIT |
| `jest`, `ts-jest`, `supertest` | Pruebas backend | MIT |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom` | Pruebas frontend | MIT |

## PostgreSQL

PostgreSQL se distribuye bajo PostgreSQL License, una licencia permisiva. En desarrollo local se usa la imagen oficial `postgres:16-alpine`.

## Nota

PROPLAN no debe copiar codigo fuente de dependencias dentro del repositorio. Las dependencias deben instalarse mediante `npm install` desde los manifiestos del proyecto.

La integracion de recursos en dashboard, PDF, Excel y seeds reutiliza dependencias existentes (`pdfkit`, `exceljs`, TypeORM, Jest/Vitest) y no agrega paquetes de terceros nuevos.
