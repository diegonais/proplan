import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    expect(screen.queryByText('Administración de usuarios')).not.toBeInTheDocument();
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

function readParams(params: unknown): Record<string, unknown> {
  return params as Record<string, unknown>;
}

function readBody(body: unknown): Record<string, unknown> {
  return body as Record<string, unknown>;
}
