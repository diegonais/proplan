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
