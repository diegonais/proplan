# Resumen de API de PROPLAN

Base local:

```text
http://localhost:3000/api/v1
```

Swagger:

```text
http://localhost:3000/api/docs
```

La API usa JSON y autenticacion Bearer JWT salvo `health` y `auth/login`.

## Autenticacion

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/auth/login` | Inicia sesion con email y password. |
| `GET` | `/auth/me` | Devuelve el usuario autenticado. |

## Salud

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/health` | Verifica que la API responde. |

## Usuarios

Requiere `ADMIN`.

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/users` | Crea usuario. |
| `GET` | `/users` | Lista usuarios con paginacion, filtros y busqueda. |
| `GET` | `/users/:uuid` | Consulta usuario por UUID. |
| `PATCH` | `/users/:uuid` | Actualiza datos generales o password. |
| `PATCH` | `/users/:uuid/status` | Activa o desactiva usuario. |
| `PATCH` | `/users/:uuid/role` | Cambia rol. |

## Proyectos

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/projects` | `ADMIN`, `PROJECT_MANAGER` | Crea proyecto. |
| `GET` | `/projects` | Todos | Lista proyectos visibles por rol. |
| `GET` | `/projects/:uuid` | Todos con acceso | Consulta proyecto. |
| `PATCH` | `/projects/:uuid` | Gestores autorizados | Actualiza proyecto. |
| `DELETE` | `/projects/:uuid` | Gestores autorizados | Elimina logicamente. |

## Miembros

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/projects/:projectUuid/members` | `ADMIN`, `PROJECT_MANAGER` | Agrega miembro activo. |
| `GET` | `/projects/:projectUuid/members` | Todos con acceso | Lista miembros. |
| `GET` | `/projects/:projectUuid/member-candidates` | `ADMIN`, `PROJECT_MANAGER` | Lista candidatos. |
| `DELETE` | `/projects/:projectUuid/members/:userUuid` | `ADMIN`, `PROJECT_MANAGER` | Retira miembro. |
| `GET` | `/projects/:projectUuid/workload` | Todos con acceso | Consulta carga de trabajo. |

## Actividades

En interfaz se usa Actividad. En API y codigo se usa `Task`.

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/projects/:projectUuid/tasks` | `ADMIN`, `PROJECT_MANAGER` | Crea actividad o subactividad. |
| `GET` | `/projects/:projectUuid/tasks` | Todos con acceso | Lista actividades visibles. |
| `GET` | `/tasks/:uuid` | Todos con acceso | Consulta actividad. |
| `PATCH` | `/tasks/:uuid` | `ADMIN`, `PROJECT_MANAGER` | Actualiza actividad. |
| `PATCH` | `/tasks/:uuid/my-progress` | `USER` | Actualiza estado y progreso propios. |
| `DELETE` | `/tasks/:uuid` | `ADMIN`, `PROJECT_MANAGER` | Elimina logicamente actividad. |

## Asignaciones

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/tasks/:taskUuid/assignments` | `ADMIN`, `PROJECT_MANAGER` | Asigna miembro a actividad. |
| `GET` | `/tasks/:taskUuid/assignments` | Todos con acceso | Lista asignaciones. |
| `PATCH` | `/task-assignments/:uuid` | `ADMIN`, `PROJECT_MANAGER` | Actualiza horas. |
| `DELETE` | `/task-assignments/:uuid` | `ADMIN`, `PROJECT_MANAGER` | Elimina asignacion. |
| `PATCH` | `/tasks/:taskUuid/main-responsible` | `ADMIN`, `PROJECT_MANAGER` | Cambia responsable principal. |

## Dependencias

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/tasks/:taskUuid/dependencies` | `ADMIN`, `PROJECT_MANAGER` | Crea dependencia `FINISH_TO_START`. |
| `GET` | `/tasks/:taskUuid/dependencies` | Todos con acceso | Lista dependencias entrantes y salientes. |
| `DELETE` | `/task-dependencies/:uuid` | `ADMIN`, `PROJECT_MANAGER` | Elimina dependencia. |

## Finanzas

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/projects/:projectUuid/financial-summary` | `ADMIN`, `PROJECT_MANAGER` | Resumen financiero. |
| `PATCH` | `/projects/:projectUuid/budget` | `ADMIN`, `PROJECT_MANAGER` | Actualiza presupuesto aprobado. |
| `PATCH` | `/tasks/:taskUuid/financials` | `ADMIN`, `PROJECT_MANAGER` | Actualiza presupuesto planificado y costo ejecutado. |

## Reportes y exportaciones

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/reports/dashboard` | Todos | Dashboard filtrado por rol. |
| `GET` | `/projects/:projectUuid/reports/gantt` | Todos con acceso | Datos de Gantt. |
| `GET` | `/projects/:projectUuid/reports/workload` | Todos con acceso | Carga por recurso. |
| `GET` | `/projects/:projectUuid/reports/budget` | `ADMIN`, `PROJECT_MANAGER` | Presupuesto versus costo. |
| `GET` | `/projects/:projectUuid/reports/traffic-light` | Todos con acceso | Semaforo calculado. |
| `GET` | `/projects/:projectUuid/reports/status` | Todos con acceso | Estado general del proyecto. |
| `GET` | `/projects/:projectUuid/exports/pdf` | `ADMIN`, `PROJECT_MANAGER` | Exporta PDF. |
| `GET` | `/projects/:projectUuid/exports/excel` | `ADMIN`, `PROJECT_MANAGER` | Exporta Excel. |

## Errores

La API usa codigos HTTP estandar:

- `400`: datos invalidos o regla de negocio incumplida.
- `401`: token ausente, invalido o vencido.
- `403`: rol o pertenencia insuficiente.
- `404`: recurso no encontrado.
- `409`: conflicto por duplicado.

Los UUID de ruta se validan antes de consultar base de datos.
