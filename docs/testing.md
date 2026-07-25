# Guia de pruebas de PROPLAN

## Objetivo

Esta guia define como verificar PROPLAN antes de una demostracion academica local.

## Comandos obligatorios

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

## Preparacion de datos para pruebas manuales

```powershell
docker compose up -d
cd backend
npm run migration:run
npm run seed:demo
```

Luego iniciar backend y frontend.

## Pruebas backend prioritarias

- Login correcto e incorrecto.
- Token ausente, invalido o vencido.
- Acceso con rol insuficiente.
- Creacion de proyecto por Administrador.
- Creacion de proyecto por Jefe de proyecto.
- Bloqueo de creacion por Usuario.
- Validacion de UUID en rutas.
- Fechas invalidas en proyectos y actividades.
- Actividad `COMPLETED` con progreso distinto de 100.
- Subactividad fuera del rango de la actividad padre.
- Dependencia consigo misma.
- Dependencia ciclica.
- Asignacion de usuario que no es miembro del proyecto.
- Unico responsable principal por actividad.
- Calculo de costo ejecutado del proyecto.
- Calculo de carga por recurso.
- Semaforo verde, amarillo y rojo.
- Exportacion PDF y Excel sin exponer campos sensibles.

## Pruebas frontend prioritarias

- Inicio de sesion con cada rol.
- Redireccion de rutas protegidas sin token.
- Menus y acciones visibles segun rol.
- Listado de proyectos.
- Detalle de proyecto.
- Formularios con errores visibles.
- Estados de carga, error y vacio.
- Actividades y subactividades.
- Dialogos de asignaciones y dependencias.
- Gantt.
- Reportes.
- Exportaciones.
- Cierre de sesion.
- Navegacion con teclado en formularios principales.

## Checklist de demostracion local

1. PostgreSQL esta healthy.
2. Migraciones ejecutadas.
3. Seed demo ejecutado dos veces sin duplicar datos.
4. Backend responde `GET /api/v1/health`.
5. Swagger abre en `/api/docs`.
6. Frontend abre en `http://localhost:5173`.
7. Login Administrador funciona.
8. Login Jefe de proyecto funciona.
9. Login Usuario funciona.
10. Los tres semaforos se visualizan: verde, amarillo y rojo.
11. Gantt muestra dependencias `FINISH_TO_START`.
12. Reporte financiero muestra presupuesto y costos.
13. PDF y Excel se descargan desde un rol autorizado.

## Evidencia sugerida

Guardar capturas reales de:

- Healthcheck.
- Swagger autorizado.
- Dashboard.
- Listado de proyectos.
- Gantt.
- Semaforo verde, amarillo y rojo.
- Reporte financiero.
- Exportacion PDF o Excel descargada.

No usar capturas inventadas.
