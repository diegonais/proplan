import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

import { App } from './App';
import { AuthenticatedUser } from './features/auth/types';
import { getCapturedRequests, installHttpMock, resetHttpMock } from './test/httpMock';

const adminUser: AuthenticatedUser = {
  uuid: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a541',
  name: 'Administrador PROPLAN',
  email: 'admin@proplan.local',
  role: 'ADMIN',
  isActive: true,
  createdAt: '2026-07-24T18:30:00.000Z',
  updatedAt: '2026-07-24T18:30:00.000Z',
};

const standardUser: AuthenticatedUser = {
  ...adminUser,
  uuid: '7f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a542',
  name: 'Usuario PROPLAN',
  email: 'usuario@proplan.local',
  role: 'USER',
};

const projectManagerUser: AuthenticatedUser = {
  ...adminUser,
  uuid: '8f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a543',
  name: 'Jefe PROPLAN',
  email: 'jefe@proplan.local',
  role: 'PROJECT_MANAGER',
};

const managedStandardUser: AuthenticatedUser = {
  ...standardUser,
  uuid: '5f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a540',
  name: 'Ana Choque',
  email: 'ana.choque@proplan.local',
};

const sampleProject = {
  uuid: '9f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a544',
  name: 'Proyecto ERP',
  description: 'Descripcion breve',
  objective: 'Centralizar la planificacion.',
  startDate: '2026-08-01',
  endDate: '2026-12-15',
  status: 'PLANNING',
  approvedBudget: '1500.00',
  managerUuid: projectManagerUser.uuid,
  manager: {
    uuid: projectManagerUser.uuid,
    name: projectManagerUser.name,
    email: projectManagerUser.email,
    role: projectManagerUser.role,
  },
  createdAt: '2026-07-24T18:30:00.000Z',
  updatedAt: '2026-07-24T18:30:00.000Z',
};

const sampleTask = {
  uuid: 'af1fbb9d-5cc8-4b20-a1b5-fb5d42f3a545',
  projectUuid: sampleProject.uuid,
  parentTaskUuid: null,
  name: 'Actividad principal',
  description: 'Trabajo observable',
  startDate: '2026-08-05',
  endDate: '2026-08-10',
  status: 'PENDING',
  progress: 0,
  estimatedHours: '12.00',
  plannedBudget: '500.00',
  actualCost: '0.00',
  createdAt: '2026-07-24T18:30:00.000Z',
  updatedAt: '2026-07-24T18:30:00.000Z',
};

const sampleSubtask = {
  ...sampleTask,
  uuid: 'bf1fbb9d-5cc8-4b20-a1b5-fb5d42f3a546',
  parentTaskUuid: sampleTask.uuid,
  name: 'Subactividad validada',
  startDate: '2026-08-11',
  endDate: '2026-08-12',
};

const sampleResource = {
  uuid: 'cf1fbb9d-5cc8-4b20-a1b5-fb5d42f3a548',
  name: 'Laptop Dell Latitude 5440',
  description: 'Equipo para pruebas de campo.',
  code: 'LAP-LOG-001',
  category: 'LAPTOP',
  serialNumber: 'SN-2026-0001',
  operationalStatus: 'OPERATIONAL',
  notes: 'Garantia vigente.',
  isActive: true,
  createdAt: '2026-07-24T18:30:00.000Z',
  updatedAt: '2026-07-24T18:30:00.000Z',
};

const maintenanceResource = {
  ...sampleResource,
  uuid: 'df1fbb9d-5cc8-4b20-a1b5-fb5d42f3a549',
  name: 'Servidor de pruebas',
  code: 'SRV-LOG-001',
  category: 'SERVER',
  serialNumber: 'SRV-2026-0001',
  operationalStatus: 'MAINTENANCE',
};

describe('App authentication flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/login');
    installHttpMock([]);
  });

  afterEach(() => {
    cleanup();
    resetHttpMock();
  });

  it('renders the login page', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Inicio de sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('toggles the visual theme and keeps the preference', async () => {
    window.localStorage.setItem('proplan.colorMode', 'light');

    render(<App />);

    fireEvent.click(await screen.findByLabelText('Cambiar a tema oscuro'));

    expect(window.localStorage.getItem('proplan.colorMode')).toBe('dark');
    expect(screen.getByLabelText('Cambiar a tema claro')).toBeInTheDocument();
  });

  it('shows understandable validation errors', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('El email es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria.')).toBeInTheDocument();
  });

  it('logs in successfully', async () => {
    installHttpMock([
      {
        method: 'POST',
        url: '/auth/login',
        response: {
          status: 200,
          data: {
            accessToken: 'valid-token',
            tokenType: 'Bearer',
            expiresIn: '1h',
            user: adminUser,
          },
        },
      },
    ]);

    render(<App />);

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'ADMIN@PROPLAN.LOCAL' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'TemporalClave123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Panel general' })).toBeInTheDocument();
    expect(window.localStorage.getItem('proplan.accessToken')).toBe('valid-token');
    expect(getCapturedRequests()[0]?.body).toEqual({
      email: 'admin@proplan.local',
      password: 'TemporalClave123',
    });
  });

  it('shows backend credential errors', async () => {
    installHttpMock([
      {
        method: 'POST',
        url: '/auth/login',
        response: {
          status: 401,
          data: {
            statusCode: 401,
            message: 'Credenciales inválidas.',
            error: 'Unauthorized',
            timestamp: '2026-07-24T18:30:00.000Z',
            path: '/auth/login',
          },
        },
      },
    ]);

    render(<App />);

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'admin@proplan.local' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'ClaveIncorrecta123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Credenciales inválidas.')).toBeInTheDocument();
  });

  it('restores the session with /auth/me', async () => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/dashboard');
    installHttpMock([
      {
        method: 'GET',
        url: '/auth/me',
        response: {
          status: 200,
          data: adminUser,
        },
      },
    ]);

    render(<App />);

    expect(await screen.findByText('Administrador PROPLAN')).toBeInTheDocument();
    expect(getCapturedRequests()[0]?.authorizationHeader).toBe('Bearer stored-token');
  });

  it('redirects protected routes to login without a session', async () => {
    window.history.pushState({}, '', '/dashboard');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Inicio de sesión' })).toBeInTheDocument();
  });

  it('redirects to login when the stored session is no longer valid', async () => {
    window.localStorage.setItem('proplan.accessToken', 'expired-token');
    window.history.pushState({}, '', '/dashboard');
    installHttpMock([
      {
        method: 'GET',
        url: '/auth/me',
        response: {
          status: 401,
          data: {
            statusCode: 401,
            message: 'Token inválido o usuario no autorizado.',
            error: 'Unauthorized',
            timestamp: '2026-07-24T18:30:00.000Z',
            path: '/auth/me',
          },
        },
      },
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Inicio de sesión' })).toBeInTheDocument();
    expect(window.localStorage.getItem('proplan.accessToken')).toBeNull();
  });

  it('logs out and removes the stored token', async () => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/dashboard');
    installHttpMock([
      {
        method: 'GET',
        url: '/auth/me',
        response: {
          status: 200,
          data: adminUser,
        },
      },
    ]);

    render(<App />);

    fireEvent.click(await screen.findByLabelText('Cerrar sesión'));

    await waitFor(() => {
      expect(window.localStorage.getItem('proplan.accessToken')).toBeNull();
    });
    expect(await screen.findByRole('heading', { name: 'Inicio de sesión' })).toBeInTheDocument();
  });

  it('adapts the menu by role', async () => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/dashboard');
    installHttpMock([
      {
        method: 'GET',
        url: '/auth/me',
        response: {
          status: 200,
          data: standardUser,
        },
      },
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Panel general' })).toBeInTheDocument();
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.queryByText('Recursos')).not.toBeInTheDocument();
    expect(screen.getByText('Reportes')).toBeInTheDocument();
    expect(screen.queryByText('Actividades')).not.toBeInTheDocument();
    expect(screen.queryByText('Equipo')).not.toBeInTheDocument();
    expect(screen.queryByText('Administración de usuarios')).not.toBeInTheDocument();
  });

  it('shows the definitive menu for administrators', async () => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/dashboard');
    installHttpMock([createMeRoute(adminUser)]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Panel general' })).toBeInTheDocument();
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Recursos')).toBeInTheDocument();
    expect(screen.getByText('Reportes')).toBeInTheDocument();
    expect(screen.getByText('Administración de usuarios')).toBeInTheDocument();
    expect(screen.queryByText('Actividades')).not.toBeInTheDocument();
    expect(screen.queryByText('Equipo')).not.toBeInTheDocument();
  });

  it('shows the definitive menu for project managers', async () => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/dashboard');
    installHttpMock([createMeRoute(projectManagerUser)]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Panel general' })).toBeInTheDocument();
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
    expect(screen.getByText('Recursos')).toBeInTheDocument();
    expect(screen.getByText('Reportes')).toBeInTheDocument();
    expect(screen.queryByText('Administración de usuarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Actividades')).not.toBeInTheDocument();
    expect(screen.queryByText('Equipo')).not.toBeInTheDocument();
  });

  it('shows an unauthorized state for restricted routes', async () => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/admin/users');
    installHttpMock([
      {
        method: 'GET',
        url: '/auth/me',
        response: {
          status: 200,
          data: standardUser,
        },
      },
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Acceso no autorizado' })).toBeInTheDocument();
  });
});

describe('Resources catalog flow', () => {
  beforeEach(() => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/resources');
    installHttpMock([]);
  });

  afterEach(() => {
    cleanup();
    resetHttpMock();
  });

  it('renders the resources catalog with filters and pagination', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createResourcesListRoute([sampleResource], { total: 20 }),
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Recursos' })).toBeInTheDocument();
    expect(await screen.findByText('LAP-LOG-001')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado operativo')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado activo')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Ir a la pagina siguiente'));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'GET' &&
            requestEntry.url === '/resources' &&
            readParams(requestEntry.params).page === 2,
        ),
      ).toBe(true);
    });
  });

  it('sends catalog filters to the resources API', async () => {
    installHttpMock([createMeRoute(adminUser), createResourcesListRoute([sampleResource])]);

    render(<App />);

    fireEvent.change(await screen.findByLabelText('Buscar'), {
      target: { value: 'Laptop' },
    });
    selectMuiOption(screen.getByRole('combobox', { name: 'Categoria' }), 'Laptop');
    selectMuiOption(screen.getByRole('combobox', { name: 'Estado operativo' }), 'En mantenimiento');
    selectMuiOption(screen.getByRole('combobox', { name: 'Estado activo' }), 'Inactivos');

    await waitFor(() => {
      expect(
        getCapturedRequests().some((requestEntry) => {
          const params = readParams(requestEntry.params);

          return (
            requestEntry.method === 'GET' &&
            requestEntry.url === '/resources' &&
            params.search === 'Laptop' &&
            params.category === 'LAPTOP' &&
            params.operationalStatus === 'MAINTENANCE' &&
            params.isActive === false
          );
        }),
      ).toBe(true);
    });
  });

  it('creates a resource as administrator', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createResourcesListRoute([]),
      {
        method: 'POST',
        url: '/resources',
        response: {
          status: 201,
          data: sampleResource,
        },
      },
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo recurso' }));
    await fillResourceForm();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'POST' &&
            requestEntry.url === '/resources' &&
            readBody(requestEntry.body).code === 'LAP-LOG-001',
        ),
      ).toBe(true);
    });
  });

  it('edits resource data, operational status and active state as administrator', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createResourcesListRoute([sampleResource]),
      {
        method: 'PATCH',
        url: `/resources/${sampleResource.uuid}`,
        response: {
          status: 200,
          data: { ...sampleResource, name: 'Laptop Dell actualizada' },
        },
      },
      {
        method: 'PATCH',
        url: `/resources/${sampleResource.uuid}/status`,
        response: {
          status: 200,
          data: {
            ...sampleResource,
            name: 'Laptop Dell actualizada',
            operationalStatus: 'MAINTENANCE',
            isActive: false,
          },
        },
      },
    ]);

    render(<App />);

    fireEvent.click(await screen.findByLabelText('Editar'));
    const editDialog = await screen.findByRole('dialog', { name: 'Editar recurso' });
    const dialog = within(editDialog);

    fireEvent.change(dialog.getByLabelText(/Nombre/), {
      target: { value: 'Laptop Dell actualizada' },
    });
    selectMuiOption(dialog.getByRole('combobox', { name: 'Estado operativo' }), 'En mantenimiento');
    fireEvent.click(dialog.getByLabelText('Recurso activo'));
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'PATCH' &&
            requestEntry.url === `/resources/${sampleResource.uuid}` &&
            readBody(requestEntry.body).name === 'Laptop Dell actualizada',
        ),
      ).toBe(true);
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'PATCH' &&
            requestEntry.url === `/resources/${sampleResource.uuid}/status` &&
            readBody(requestEntry.body).operationalStatus === 'MAINTENANCE' &&
            readBody(requestEntry.body).isActive === false,
        ),
      ).toBe(true);
    });
  });

  it('shows read-only actions for project managers', async () => {
    installHttpMock([
      createMeRoute(projectManagerUser),
      createResourcesListRoute([sampleResource]),
    ]);

    render(<App />);

    expect(await screen.findByText('LAP-LOG-001')).toBeInTheDocument();
    expect(
      screen.getByText(/Su rol permite consultar el catalogo y la disponibilidad/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo recurso' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Eliminar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Consultar disponibilidad')).toBeInTheDocument();
  });

  it('shows duplicate code errors from the backend', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createResourcesListRoute([]),
      {
        method: 'POST',
        url: '/resources',
        response: {
          status: 409,
          data: {
            statusCode: 409,
            message: 'El codigo de recurso ya esta registrado.',
            error: 'Conflict',
            timestamp: '2026-07-24T18:30:00.000Z',
            path: '/resources',
          },
        },
      },
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo recurso' }));
    await fillResourceForm();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El codigo de recurso ya esta registrado.')).toBeInTheDocument();
  });

  it('shows maintenance status and explains unavailable resources', async () => {
    installHttpMock([
      createMeRoute(projectManagerUser),
      createResourcesListRoute([maintenanceResource]),
      createAvailabilityRoute(maintenanceResource.uuid, {
        resourceUuid: maintenanceResource.uuid,
        available: false,
        operationalStatus: 'MAINTENANCE',
        unavailableReason: 'NON_OPERATIONAL_STATUS',
        conflicts: [],
      }),
    ]);

    render(<App />);

    expect(await screen.findByText('En mantenimiento')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Disponibilidad desde'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText('Disponibilidad hasta'), {
      target: { value: '2026-08-10' },
    });

    expect(await screen.findByText('No disponible')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Consultar disponibilidad'));

    expect(
      await screen.findAllByText('El recurso no esta en estado operativo.'),
    ).toHaveLength(2);
  });

  it('consults availability and shows assignment conflicts from the backend', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createResourcesListRoute([sampleResource]),
      createAvailabilityRoute(sampleResource.uuid, {
        resourceUuid: sampleResource.uuid,
        available: false,
        operationalStatus: 'OPERATIONAL',
        unavailableReason: 'ASSIGNMENT_CONFLICT',
        conflicts: [
          {
            uuid: 'ef1fbb9d-5cc8-4b20-a1b5-fb5d42f3a550',
            projectUuid: sampleProject.uuid,
            taskUuid: sampleTask.uuid,
            startDate: '2026-08-02',
            endDate: '2026-08-05',
          },
        ],
      }),
    ]);

    render(<App />);

    fireEvent.change(await screen.findByLabelText('Disponibilidad desde'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText('Disponibilidad hasta'), {
      target: { value: '2026-08-10' },
    });

    expect(await screen.findByText('Asignacion superpuesta')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Consultar disponibilidad'));

    expect(await screen.findByText('Asignaciones en conflicto')).toBeInTheDocument();
    expect(screen.getByText('2026-08-02 a 2026-08-05')).toBeInTheDocument();
  });

  it('confirms logical deletion before calling the resources API', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createResourcesListRoute([sampleResource]),
      {
        method: 'DELETE',
        url: `/resources/${sampleResource.uuid}`,
        response: {
          status: 204,
          data: null,
        },
      },
    ]);

    render(<App />);

    fireEvent.click(await screen.findByLabelText('Eliminar'));
    expect(await screen.findByRole('dialog', { name: 'Eliminar recurso' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'DELETE' &&
            requestEntry.url === `/resources/${sampleResource.uuid}`,
        ),
      ).toBe(true);
    });
  });

  it('shows forbidden errors from the resources API', async () => {
    installHttpMock([
      createMeRoute(projectManagerUser),
      {
        method: 'GET',
        url: '/resources',
        response: {
          status: 403,
          data: {
            statusCode: 403,
            message: 'No tiene permiso para consultar recursos.',
            error: 'Forbidden',
            timestamp: '2026-07-24T18:30:00.000Z',
            path: '/resources',
          },
        },
      },
    ]);

    render(<App />);

    expect(await screen.findByText('No tiene permiso para consultar recursos.')).toBeInTheDocument();
  });

  it('shows conflict errors when status updates are rejected', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createResourcesListRoute([sampleResource]),
      {
        method: 'PATCH',
        url: `/resources/${sampleResource.uuid}`,
        response: {
          status: 200,
          data: sampleResource,
        },
      },
      {
        method: 'PATCH',
        url: `/resources/${sampleResource.uuid}/status`,
        response: {
          status: 409,
          data: {
            statusCode: 409,
            message: 'El recurso tiene asignaciones actuales o futuras.',
            error: 'Conflict',
            timestamp: '2026-07-24T18:30:00.000Z',
            path: `/resources/${sampleResource.uuid}/status`,
          },
        },
      },
    ]);

    render(<App />);

    fireEvent.click(await screen.findByLabelText('Editar'));
    const editDialog = await screen.findByRole('dialog', { name: 'Editar recurso' });
    selectMuiOption(
      within(editDialog).getByRole('combobox', { name: 'Estado operativo' }),
      'En mantenimiento',
    );
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('El recurso tiene asignaciones actuales o futuras.'),
    ).toBeInTheDocument();
  });

  it('blocks direct access to resources for regular users', async () => {
    installHttpMock([createMeRoute(standardUser)]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Acceso no autorizado' })).toBeInTheDocument();
    expect(screen.queryByText('Recursos')).not.toBeInTheDocument();
  });
});

describe('Project management flow', () => {
  beforeEach(() => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/projects');
    installHttpMock([]);
  });

  afterEach(() => {
    cleanup();
    resetHttpMock();
  });

  it('renders the project list with filters and pagination', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createManagersRoute(),
      createProjectsListRoute([sampleProject]),
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Proyectos' })).toBeInTheDocument();
    expect(await screen.findByText('Proyecto ERP')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar por nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByLabelText('Jefe de proyecto')).toBeInTheDocument();
  });

  it('sends project filters to the API', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createManagersRoute(),
      createProjectsListRoute([sampleProject]),
    ]);

    render(<App />);

    fireEvent.change(await screen.findByLabelText('Buscar por nombre'), {
      target: { value: 'ERP' },
    });

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'GET' &&
            requestEntry.url === '/projects' &&
            readParams(requestEntry.params).search === 'ERP',
        ),
      ).toBe(true);
    });
  });

  it('creates a project as administrator with a selected manager', async () => {
    window.history.pushState({}, '', '/projects/new');
    installHttpMock([
      createMeRoute(adminUser),
      createManagersRoute(),
      {
        method: 'POST',
        url: '/projects',
        response: {
          status: 201,
          data: sampleProject,
        },
      },
      {
        method: 'GET',
        url: `/projects/${sampleProject.uuid}`,
        response: {
          status: 200,
          data: sampleProject,
        },
      },
    ]);

    render(<App />);

    await fillProjectForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Crear proyecto' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'POST' &&
            requestEntry.url === '/projects' &&
            readBody(requestEntry.body).managerUuid === projectManagerUser.uuid,
        ),
      ).toBe(true);
    });
  });

  it('creates a project as project manager without showing the manager selector', async () => {
    window.history.pushState({}, '', '/projects/new');
    installHttpMock([
      createMeRoute(projectManagerUser),
      {
        method: 'POST',
        url: '/projects',
        response: {
          status: 201,
          data: sampleProject,
        },
      },
      {
        method: 'GET',
        url: `/projects/${sampleProject.uuid}`,
        response: {
          status: 200,
          data: sampleProject,
        },
      },
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Crear proyecto' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Jefe de proyecto')).not.toBeInTheDocument();
    await fillProjectForm();
    fireEvent.click(screen.getByRole('button', { name: 'Crear proyecto' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'POST' &&
            requestEntry.url === '/projects' &&
            !('managerUuid' in readBody(requestEntry.body)),
        ),
      ).toBe(true);
    });
  });

  it('hides project management actions for regular users', async () => {
    installHttpMock([createMeRoute(standardUser), createProjectsListRoute([sampleProject])]);

    render(<App />);

    expect(await screen.findByText('Proyecto ERP')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo proyecto' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Eliminar')).not.toBeInTheDocument();
  });

  it('validates project date ranges before submitting', async () => {
    window.history.pushState({}, '', '/projects/new');
    installHttpMock([createMeRoute(projectManagerUser)]);

    render(<App />);

    await fillProjectForm({ startDate: '2026-09-10', endDate: '2026-09-01' });
    fireEvent.click(await screen.findByRole('button', { name: 'Crear proyecto' }));

    expect(
      await screen.findByText('La fecha de fin no puede ser anterior a la fecha de inicio.'),
    ).toBeInTheDocument();
    expect(getCapturedRequests().some((requestEntry) => requestEntry.method === 'POST')).toBe(false);
  });

  it('confirms project deletion before calling the API', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createManagersRoute(),
      createProjectsListRoute([sampleProject]),
      {
        method: 'DELETE',
        url: `/projects/${sampleProject.uuid}`,
        response: {
          status: 204,
          data: null,
        },
      },
    ]);

    render(<App />);

    fireEvent.click(await screen.findByLabelText('Eliminar'));
    expect(await screen.findByRole('dialog', { name: 'Eliminar proyecto' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'DELETE' && requestEntry.url === `/projects/${sampleProject.uuid}`,
        ),
      ).toBe(true);
    });
  });

  it('shows forbidden errors from the project list', async () => {
    installHttpMock([
      createMeRoute(projectManagerUser),
      {
        method: 'GET',
        url: '/projects',
        response: {
          status: 403,
          data: {
            statusCode: 403,
            message: 'No tiene permiso para consultar proyectos.',
            error: 'Forbidden',
            timestamp: '2026-07-24T18:30:00.000Z',
            path: '/projects',
          },
        },
      },
    ]);

    render(<App />);

    expect(
      await screen.findByText('No tiene permiso para consultar proyectos.'),
    ).toBeInTheDocument();
  });

  it('shows not found errors in project detail', async () => {
    window.history.pushState({}, '', `/projects/${sampleProject.uuid}`);
    installHttpMock([
      createMeRoute(adminUser),
      {
        method: 'GET',
        url: `/projects/${sampleProject.uuid}`,
        response: {
          status: 404,
          data: {
            statusCode: 404,
            message: 'Proyecto no encontrado.',
            error: 'NotFound',
            timestamp: '2026-07-24T18:30:00.000Z',
            path: `/projects/${sampleProject.uuid}`,
          },
        },
      },
    ]);

    render(<App />);

    expect(await screen.findByText('Proyecto no encontrado.')).toBeInTheDocument();
  });
});

describe('Project detail behavior', () => {
  beforeEach(() => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', `/projects/${sampleProject.uuid}`);
    installHttpMock([]);
  });

  afterEach(() => {
    cleanup();
    resetHttpMock();
    vi.restoreAllMocks();
  });

  it('lists activities and preserves date-only values without shifting days', async () => {
    installHttpMock([
      createMeRoute(projectManagerUser),
      createProjectDetailRoute(),
      createTasksRoute([sampleTask, sampleSubtask]),
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Actividades' }));

    expect(await screen.findByText('Actividad principal')).toBeInTheDocument();
    expect(screen.getByText('Subactividad validada')).toBeInTheDocument();
    expect(screen.getByText('2026-08-05 a 2026-08-10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva actividad' })).toBeInTheDocument();
  });

  it('lets regular users update progress but hides management actions', async () => {
    installHttpMock([
      createMeRoute(standardUser),
      createProjectDetailRoute(),
      createTasksRoute([sampleTask]),
      {
        method: 'PATCH',
        url: `/tasks/${sampleTask.uuid}/my-progress`,
        response: {
          status: 200,
          data: { ...sampleTask, status: 'IN_PROGRESS', progress: 50 },
        },
      },
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Actividades' }));
    fireEvent.click(await screen.findByLabelText('Actualizar avance'));
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Progreso' }), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'PATCH' &&
            requestEntry.url === `/tasks/${sampleTask.uuid}/my-progress` &&
            readBody(requestEntry.body).progress === 50,
        ),
      ).toBe(true);
    });
    expect(screen.queryByRole('button', { name: 'Nueva actividad' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Eliminar actividad')).not.toBeInTheDocument();
  });

  it('keeps team management inside the project detail', async () => {
    installHttpMock([
      createMeRoute(projectManagerUser),
      createProjectDetailRoute(),
      createProjectMembersRoute([]),
      createProjectWorkloadRoute([]),
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Equipo' }));

    expect(await screen.findByText('No hay miembros registrados.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar miembro' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Reportes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Gantt' })).not.toBeInTheDocument();
  });

  it('opens the main reports module from project detail', async () => {
    installHttpMock([
      createMeRoute(projectManagerUser),
      createProjectDetailRoute(),
      createProjectsListRoute([sampleProject]),
      createGanttReportRoute(),
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Ver reportes' }));

    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/reports');
      expect(window.location.search).toBe(`?projectUuid=${sampleProject.uuid}`);
    });
  });
});

describe('Reports module', () => {
  beforeEach(() => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/reports');
    installHttpMock([]);
  });

  afterEach(() => {
    cleanup();
    resetHttpMock();
    vi.restoreAllMocks();
  });

  it('shows the authorized project selector and loads Gantt after selecting a project', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createProjectsListRoute([sampleProject]),
      createGanttReportRoute(),
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Proyecto' }));
    fireEvent.click(await screen.findByRole('option', { name: sampleProject.name }));

    expect(await screen.findByRole('heading', { name: 'Diagrama de Gantt' })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'GET' &&
            requestEntry.url === `/projects/${sampleProject.uuid}/reports/gantt`,
        ),
      ).toBe(true);
    });
  });

  it('opens reports from projectUuid and keeps financial details hidden for regular users', async () => {
    window.history.pushState({}, '', `/reports?projectUuid=${sampleProject.uuid}`);
    installHttpMock([
      createMeRoute(standardUser),
      createProjectsListRoute([sampleProject]),
      createGanttReportRoute(),
      createStatusReportRoute(),
      createWorkloadReportRoute([]),
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Indicadores y exportaciones' }));

    expect(await screen.findByText('No hay horas asignadas.')).toBeInTheDocument();
    expect(screen.getByText('No hay actividades vencidas.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar Excel' })).not.toBeInTheDocument();
    expect(
      getCapturedRequests().some((requestEntry) => requestEntry.url.includes('/reports/budget')),
    ).toBe(false);
  });

  it('downloads PDF and Excel exports for project managers', async () => {
    window.history.pushState({}, '', `/reports?projectUuid=${sampleProject.uuid}`);
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: () => 'blob:proplan-export',
      });
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: () => undefined,
      });
    }
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:proplan-export');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    installHttpMock([
      createMeRoute(projectManagerUser),
      createProjectsListRoute([sampleProject]),
      createGanttReportRoute(),
      createStatusReportRoute(),
      createWorkloadReportRoute([
        {
          projectUuid: sampleProject.uuid,
          userUuid: standardUser.uuid,
          user: {
            uuid: standardUser.uuid,
            name: standardUser.name,
            email: standardUser.email,
            role: standardUser.role,
          },
          assignedHours: '8.00',
        },
      ]),
      createBudgetReportRoute(),
      createExportRoute('pdf', 'proplan-proyecto-erp.pdf'),
      createExportRoute('excel', 'proplan-proyecto-erp.xlsx'),
    ]);

    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Indicadores y exportaciones' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'GET' &&
            requestEntry.url === `/projects/${sampleProject.uuid}/exports/pdf`,
        ),
      ).toBe(true);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Exportar Excel' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'GET' &&
            requestEntry.url === `/projects/${sampleProject.uuid}/exports/excel`,
        ),
      ).toBe(true);
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:proplan-export');
  });
});

describe('User administration flow', () => {
  beforeEach(() => {
    window.localStorage.setItem('proplan.accessToken', 'stored-token');
    window.history.pushState({}, '', '/admin/users');
    installHttpMock([]);
  });

  afterEach(() => {
    cleanup();
    resetHttpMock();
  });

  it('lists users and creates a managed user as administrator', async () => {
    installHttpMock([
      createMeRoute(adminUser),
      createUsersListRoute([managedStandardUser]),
      {
        method: 'POST',
        url: '/users',
        response: {
          status: 201,
          data: {
            ...managedStandardUser,
            uuid: '6f1fbb9d-5cc8-4b20-a1b5-fb5d42f3a547',
            email: 'nuevo.usuario@proplan.local',
          },
        },
      },
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Administracion de usuarios' })).toBeInTheDocument();
    expect(await screen.findByText('Ana Choque')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
    const createDialog = await screen.findByRole('dialog', { name: 'Crear usuario' });
    const dialog = within(createDialog);

    fireEvent.change(dialog.getByLabelText(/Nombre/), {
      target: { value: 'Nuevo Usuario' },
    });
    fireEvent.change(dialog.getByLabelText(/Email/), {
      target: { value: 'NUEVO.USUARIO@PROPLAN.LOCAL' },
    });
    fireEvent.change(dialog.getByLabelText(/Password temporal/), {
      target: { value: 'TemporalClave123' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(
        getCapturedRequests().some(
          (requestEntry) =>
            requestEntry.method === 'POST' &&
            requestEntry.url === '/users' &&
            readBody(requestEntry.body).email === 'nuevo.usuario@proplan.local',
        ),
      ).toBe(true);
    });
  });
});

function createMeRoute(user: AuthenticatedUser) {
  return {
    method: 'GET' as const,
    url: '/auth/me',
    response: {
      status: 200,
      data: user,
    },
  };
}

function createUsersListRoute(users: unknown[]) {
  return {
    method: 'GET' as const,
    url: '/users',
    response: {
      status: 200,
      data: {
        data: users,
        meta: {
          page: 1,
          limit: 10,
          total: users.length,
          totalPages: users.length > 0 ? 1 : 0,
        },
      },
    },
  };
}

function createManagersRoute() {
  return {
    method: 'GET' as const,
    url: '/users',
    response: ({ config }: { config: { params?: { role?: string } } }) => ({
      status: 200,
      data: {
        data:
          config.params?.role === 'PROJECT_MANAGER'
            ? [
                {
                  uuid: projectManagerUser.uuid,
                  name: projectManagerUser.name,
                  email: projectManagerUser.email,
                  role: projectManagerUser.role,
                },
              ]
            : [],
        meta: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
        },
      },
    }),
  };
}

function createProjectsListRoute(projects: unknown[]) {
  return {
    method: 'GET' as const,
    url: '/projects',
    response: {
      status: 200,
      data: {
        data: projects,
        meta: {
          page: 1,
          limit: 10,
          total: projects.length,
          totalPages: projects.length > 0 ? 1 : 0,
        },
      },
    },
  };
}

function createResourcesListRoute(resources: unknown[], overrides: { total?: number } = {}) {
  return {
    method: 'GET' as const,
    url: '/resources',
    response: {
      status: 200,
      data: {
        data: resources,
        meta: {
          page: 1,
          limit: 10,
          total: overrides.total ?? resources.length,
          totalPages: (overrides.total ?? resources.length) > 0 ? 1 : 0,
        },
      },
    },
  };
}

function createAvailabilityRoute(resourceUuid: string, availability: unknown) {
  return {
    method: 'GET' as const,
    url: `/resources/${resourceUuid}/availability`,
    response: {
      status: 200,
      data: availability,
    },
  };
}

function createProjectDetailRoute() {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}`,
    response: {
      status: 200,
      data: sampleProject,
    },
  };
}

function createTasksRoute(tasks: unknown[]) {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}/tasks`,
    response: {
      status: 200,
      data: tasks,
    },
  };
}

function createProjectMembersRoute(members: unknown[]) {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}/members`,
    response: {
      status: 200,
      data: members,
    },
  };
}

function createProjectWorkloadRoute(workload: unknown[]) {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}/workload`,
    response: {
      status: 200,
      data: workload,
    },
  };
}

function createGanttReportRoute() {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}/reports/gantt`,
    response: {
      status: 200,
      data: {
        projectUuid: sampleProject.uuid,
        projectName: sampleProject.name,
        projectStartDate: sampleProject.startDate,
        projectEndDate: sampleProject.endDate,
        datePolicy: 'Las fechas se presentan como YYYY-MM-DD.',
        tasks: [
          {
            uuid: sampleTask.uuid,
            projectUuid: sampleProject.uuid,
            parentTaskUuid: null,
            name: sampleTask.name,
            startDate: sampleTask.startDate,
            endDate: sampleTask.endDate,
            status: sampleTask.status,
            progress: sampleTask.progress,
            level: 0,
          },
        ],
        dependencies: [],
      },
    },
  };
}

function createStatusReportRoute() {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}/reports/status`,
    response: {
      status: 200,
      data: {
        projectUuid: sampleProject.uuid,
        projectName: sampleProject.name,
        projectStatus: sampleProject.status,
        startDate: sampleProject.startDate,
        endDate: sampleProject.endDate,
        progressPercentage: '45.00',
        totalTasks: 1,
        activeNonCancelledTasks: 1,
        taskStatusCounts: [],
        trafficLight: {
          color: 'GREEN',
          reasons: ['No existen actividades vencidas.'],
          today: '2026-08-15',
          totalActualCost: '0.00',
          approvedBudget: '0.00',
          consumedPercentage: '0.00',
          overdueTasksPercentage: '0.00',
          overdueTasksCount: 0,
          activeNonCancelledTasksCount: 1,
          isProjectOverdue: false,
          overdueTasks: [],
          canViewFinancialDetails: true,
        },
      },
    },
  };
}

function createWorkloadReportRoute(workload: unknown[]) {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}/reports/workload`,
    response: {
      status: 200,
      data: workload,
    },
  };
}

function createBudgetReportRoute() {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}/reports/budget`,
    response: {
      status: 200,
      data: {
        approvedBudget: '1500.00',
        distributedBudget: '500.00',
        totalActualCost: '125.00',
        balance: '1375.00',
        variance: '1375.00',
        consumedPercentage: '8.33',
        distributedBudgetDifference: '-1000.00',
        budgetExceeded: false,
        operationalBudgetPolicy: 'Se excluyen actividades CANCELLED.',
        tasks: [],
      },
    },
  };
}

function createExportRoute(format: 'pdf' | 'excel', fileName: string) {
  return {
    method: 'GET' as const,
    url: `/projects/${sampleProject.uuid}/exports/${format}`,
    response: {
      status: 200,
      data: new Blob(['proplan'], {
        type:
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      headers: {
        'content-disposition': `attachment; filename="${fileName}"`,
      },
    },
  };
}

async function fillProjectForm(overrides: Partial<Record<'startDate' | 'endDate', string>> = {}) {
  fireEvent.change(await screen.findByLabelText(/Nombre/), {
    target: { value: 'Proyecto ERP' },
  });
  fireEvent.change(screen.getByLabelText(/Objetivo/), {
    target: { value: 'Centralizar la planificacion.' },
  });
  fireEvent.change(screen.getByLabelText(/Fecha de inicio/), {
    target: { value: overrides.startDate ?? '2026-08-01' },
  });
  fireEvent.change(screen.getByLabelText(/Fecha de fin/), {
    target: { value: overrides.endDate ?? '2026-12-15' },
  });
  fireEvent.change(screen.getByLabelText(/Presupuesto aprobado/), {
    target: { value: '1500' },
  });
}

async function fillResourceForm() {
  const resourceDialog = within(await screen.findByRole('dialog', { name: 'Crear recurso' }));

  fireEvent.change(resourceDialog.getByLabelText(/Nombre/), {
    target: { value: 'Laptop Dell Latitude 5440' },
  });
  fireEvent.change(resourceDialog.getByLabelText(/Codigo/), {
    target: { value: 'lap-log-001' },
  });
  fireEvent.change(resourceDialog.getByLabelText(/Descripcion/), {
    target: { value: 'Equipo para pruebas de campo.' },
  });
  selectMuiOption(resourceDialog.getByRole('combobox', { name: 'Categoria' }), 'Laptop');
  fireEvent.change(resourceDialog.getByLabelText(/Numero de serie/), {
    target: { value: 'SN-2026-0001' },
  });
  selectMuiOption(resourceDialog.getByRole('combobox', { name: 'Estado operativo' }), 'Operativo');
  fireEvent.change(resourceDialog.getByLabelText(/Notas/), {
    target: { value: 'Garantia vigente.' },
  });
}

function selectMuiOption(combobox: HTMLElement, optionName: string): void {
  fireEvent.mouseDown(combobox);
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

function readParams(params: unknown): Record<string, unknown> {
  return params as Record<string, unknown>;
}

function readBody(body: unknown): Record<string, unknown> {
  return body as Record<string, unknown>;
}
