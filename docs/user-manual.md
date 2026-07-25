# Manual de usuario de PROPLAN

Este manual describe el uso funcional de PROPLAN para una demostracion academica local. No incluye capturas inventadas.

> Espacio para captura real: pantalla de inicio de sesion.

## Inicio de sesion

1. Abrir `http://localhost:5173`.
2. Ingresar email y password.
3. Presionar el boton de inicio de sesion.
4. Si las credenciales son correctas, PROPLAN muestra el dashboard segun el rol.

Credenciales de demo local:

- Administrador: `admin@proplan.local`
- Jefe de proyecto: `laura.mamani@proplan.local`
- Jefe de proyecto: `carlos.quispe@proplan.local`
- Usuario: `ana.choque@proplan.local`
- Usuario: `roberto.vargas@proplan.local`
- Usuario: `maria.flores@proplan.local`
- Usuario: `diego.rivera@proplan.local`
- Usuario: `sofia.nunez@proplan.local`

Password por defecto: `ProplanDemo2026!`

## Roles

### Administrador

Puede gestionar usuarios, consultar todos los proyectos, crear proyectos, asignar jefes de proyecto, consultar reportes financieros y exportar informacion.

### Jefe de proyecto

Puede gestionar los proyectos donde figura como responsable, administrar equipo, actividades, dependencias, asignaciones, presupuesto, costos, Gantt, reportes y exportaciones.

### Usuario

Puede consultar proyectos donde participa, revisar actividades asignadas y actualizar su avance cuando corresponda. No administra usuarios ni informacion financiera global.

## Usuarios

> Espacio para captura real: listado de usuarios.

Disponible para Administrador:

1. Abrir el modulo de usuarios.
2. Revisar listado, busqueda y filtros.
3. Crear usuarios con nombre, email, rol y password.
4. Activar o desactivar usuarios.
5. Cambiar rol cuando sea necesario.

Reglas importantes:

- No se debe dejar el sistema sin Administrador activo.
- Los emails son unicos.
- Los usuarios inactivos no deben asignarse a proyectos.

## Proyectos

> Espacio para captura real: listado de proyectos.

1. Abrir el modulo de proyectos.
2. Revisar nombre, estado, fechas, jefe de proyecto y presupuesto si el rol lo permite.
3. Crear proyecto con nombre, objetivo, fechas, estado, presupuesto aprobado y jefe de proyecto.
4. Editar datos generales cuando se tenga permiso.
5. Eliminar proyecto de forma logica si corresponde.

Estados disponibles:

- `PLANNING`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

## Actividades

> Espacio para captura real: pestana de actividades del proyecto.

Las actividades organizan el trabajo de un proyecto. En interfaz se usa el termino Actividad; en codigo se representa como `Task`.

Acciones principales:

1. Abrir detalle de proyecto.
2. Entrar a Actividades.
3. Crear actividad con fechas, estado, progreso, horas estimadas, presupuesto planificado y costo ejecutado.
4. Crear subactividad seleccionando una actividad padre.
5. Editar actividad.
6. Eliminar logicamente cuando no tenga subactividades activas.

Estados de actividad:

- `PENDING`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETED`
- `CANCELLED`

Reglas:

- `COMPLETED` requiere progreso 100.
- La fecha de fin no puede ser anterior a la fecha de inicio.
- Una subactividad debe estar dentro del rango de su actividad padre.
- El progreso debe estar entre 0 y 100.

## Equipo

> Espacio para captura real: pestana de equipo del proyecto.

1. Abrir detalle de proyecto.
2. Entrar a Equipo.
3. Agregar usuarios activos como miembros.
4. Revisar carga de horas por recurso.
5. Retirar miembros solo si no viola reglas de asignaciones activas o jefatura.

Un usuario debe ser miembro del proyecto antes de ser asignado a una actividad.

## Asignaciones y responsable principal

> Espacio para captura real: dialogo de asignaciones.

1. Desde Actividades, abrir asignaciones.
2. Agregar miembros del proyecto.
3. Definir horas asignadas.
4. Marcar un unico responsable principal.

Reglas:

- Una actividad puede tener varias asignaciones.
- Solo una asignacion puede ser responsable principal.
- El responsable principal debe estar asignado y pertenecer al proyecto.

## Dependencias

> Espacio para captura real: dialogo de dependencias.

PROPLAN soporta inicialmente dependencias `FINISH_TO_START`.

1. Abrir dependencias de una actividad.
2. Seleccionar actividad predecesora.
3. Guardar dependencia.

Reglas:

- Una actividad no puede depender de si misma.
- No se permiten ciclos.
- Las actividades deben pertenecer al mismo proyecto.
- La sucesora no debe iniciar antes de que termine la predecesora.

## Presupuesto

> Espacio para captura real: pestana de presupuesto.

Los jefes de proyecto y administradores pueden revisar:

- Presupuesto aprobado del proyecto.
- Presupuesto planificado de actividades.
- Costo ejecutado de actividades.
- Costo ejecutado total.
- Saldo o diferencia.
- Porcentaje consumido.

El costo ejecutado del proyecto se calcula sumando el costo ejecutado de sus actividades activas no canceladas.

## Gantt

> Espacio para captura real: diagrama de Gantt.

El Gantt muestra:

- Actividades y subactividades.
- Fechas de inicio y fin.
- Progreso.
- Dependencias `FINISH_TO_START`.

Usar esta vista para explicar el cronograma, los bloqueos y la secuencia del trabajo.

## Reportes

> Espacio para captura real: pestana de reportes.

Reportes disponibles:

- Dashboard general por rol.
- Estado general del proyecto.
- Semaforo verde, amarillo o rojo.
- Carga de trabajo por recurso.
- Presupuesto versus costo real.
- Gantt del proyecto.

Escenarios del seed demo:

- Verde: `Portal de seguimiento academico`.
- Amarillo: `Implementacion de control de costos`.
- Rojo: `Migracion de planificacion operativa`.

## Exportaciones

> Espacio para captura real: botones de exportacion.

Los roles Administrador y Jefe de proyecto pueden exportar reportes completos:

- PDF.
- Excel.

Los archivos se generan en memoria y no se guardan como temporales en el servidor.

## Cierre de sesion

1. Abrir el menu de usuario.
2. Seleccionar cierre de sesion.
3. El frontend elimina el token local.
4. La siguiente accion protegida pedira iniciar sesion nuevamente.
