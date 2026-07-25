import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Dispatch, SetStateAction, SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { getRoleLabel, UserRole } from '../../auth/types';
import { createUser, listUsers, updateUserRole, updateUserStatus } from '../services/usersApi';
import { PaginatedUsersResponse, User, UserPayload, userRoles } from '../types';

const defaultResponse: PaginatedUsersResponse = {
  data: [],
  meta: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
};

const defaultFormValues: UserPayload = {
  name: '',
  email: '',
  password: '',
  role: 'USER',
};

type FormErrors = Partial<Record<keyof UserPayload, string>>;

export function UsersAdminPage() {
  const { showNotification } = useNotifications();
  const [usersResponse, setUsersResponse] = useState<PaginatedUsersResponse>(defaultResponse);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [isActive, setIsActive] = useState<'true' | 'false' | ''>('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState<UserPayload>(defaultFormValues);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setUsersResponse(
        await listUsers({
          page: page + 1,
          limit,
          search,
          role: role || undefined,
          isActive: parseActiveFilter(isActive),
          orderBy: 'createdAt',
          order: 'DESC',
        }),
      );
    } catch (requestError: unknown) {
      setUsersResponse(defaultResponse);
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsLoading(false);
    }
  }, [isActive, limit, page, role, search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const hasFilters = search.trim().length > 0 || role.length > 0 || isActive.length > 0;
  const emptyMessage = hasFilters
    ? 'No se encontraron usuarios con los filtros seleccionados.'
    : 'No hay usuarios registrados.';

  const selectedUserName = useMemo(
    () => userToDeactivate?.name ?? 'seleccionado',
    [userToDeactivate],
  );

  const openCreateDialog = () => {
    setFormValues(defaultFormValues);
    setFormErrors({});
    setSubmitError(null);
    setIsCreateDialogOpen(true);
  };

  const handleCreateUser = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateUserForm(formValues);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createUser({
        name: formValues.name.trim(),
        email: formValues.email.trim().toLowerCase(),
        password: formValues.password,
        role: formValues.role,
      });
      showNotification('Usuario creado correctamente.', 'success');
      setIsCreateDialogOpen(false);
      await loadUsers();
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (user: User, nextRole: UserRole) => {
    if (user.role === nextRole) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserRole(user.uuid, nextRole);
      showNotification('Rol actualizado correctamente.', 'success');
      await loadUsers();
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (user: User, nextIsActive: boolean) => {
    setIsSubmitting(true);
    try {
      await updateUserStatus(user.uuid, nextIsActive);
      showNotification(
        nextIsActive ? 'Usuario activado correctamente.' : 'Usuario desactivado correctamente.',
        'success',
      );
      setUserToDeactivate(null);
      await loadUsers();
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h1" variant="h1">
            Administracion de usuarios
          </Typography>
          <Typography color="text.secondary">
            Gestion de usuarios, roles y estado de acceso.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreateDialog}>
          Nuevo usuario
        </Button>
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Buscar por nombre o email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
          <TextField
            label="Rol"
            select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as UserRole | '');
              setPage(0);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {userRoles.map((userRole) => (
              <MenuItem key={userRole} value={userRole}>
                {getRoleLabel(userRole)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Estado"
            select
            value={isActive}
            onChange={(event) => {
              setIsActive(event.target.value as 'true' | 'false' | '');
              setPage(0);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="true">Activos</MenuItem>
            <MenuItem value="false">Inactivos</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {error !== null ? <Alert severity="error">{error}</Alert> : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        {isLoading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress aria-label="Cargando usuarios" />
            <Typography color="text.secondary">Cargando usuarios</Typography>
          </Stack>
        ) : (
          <Table aria-label="Listado de usuarios">
            <TableHead>
              <TableRow>
                <TableCell>Usuario</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usersResponse.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <Typography color="text.secondary">{emptyMessage}</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                usersResponse.data.map((user) => (
                  <TableRow key={user.uuid} hover>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography sx={{ fontWeight: 700 }}>{user.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <TextField
                        label={`Rol de ${user.name}`}
                        select
                        value={user.role}
                        size="small"
                        onChange={(event) => {
                          void handleRoleChange(user, event.target.value as UserRole);
                        }}
                        disabled={isSubmitting}
                      >
                        {userRoles.map((userRole) => (
                          <MenuItem key={userRole} value={userRole}>
                            {getRoleLabel(userRole)}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.isActive ? 'Activo' : 'Inactivo'}
                        color={user.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {user.isActive ? (
                        <Button
                          color="error"
                          variant="outlined"
                          size="small"
                          disabled={isSubmitting}
                          onClick={() => {
                            setUserToDeactivate(user);
                          }}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={isSubmitting}
                          onClick={() => {
                            void handleStatusChange(user, true);
                          }}
                        >
                          Activar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        <TablePagination
          component="div"
          count={usersResponse.meta.total}
          page={page}
          rowsPerPage={limit}
          rowsPerPageOptions={[5, 10, 25]}
          labelRowsPerPage="Filas por pagina"
          labelDisplayedRows={({ from, to, count }) =>
            `${String(from)}-${String(to)} de ${String(count)}`
          }
          onPageChange={(_event, nextPage) => {
            setPage(nextPage);
          }}
          onRowsPerPageChange={(event) => {
            setLimit(Number(event.target.value));
            setPage(0);
          }}
        />
      </TableContainer>

      <Dialog
        open={isCreateDialogOpen}
        onClose={
          isSubmitting
            ? undefined
            : () => {
                setIsCreateDialogOpen(false);
              }
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Crear usuario</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            id="user-form"
            spacing={2.5}
            onSubmit={(event) => {
              void handleCreateUser(event);
            }}
            sx={{ pt: 1 }}
          >
            {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}
            <TextField
              label="Nombre"
              value={formValues.name}
              onChange={(event) => {
                updateFormValue('name', event.target.value, setFormValues);
              }}
              error={formErrors.name !== undefined}
              helperText={formErrors.name ?? 'Nombre visible del usuario.'}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={formValues.email}
              onChange={(event) => {
                updateFormValue('email', event.target.value, setFormValues);
              }}
              error={formErrors.email !== undefined}
              helperText={formErrors.email ?? 'Correo usado para iniciar sesion.'}
              required
            />
            <TextField
              label="Password temporal"
              type="password"
              value={formValues.password}
              onChange={(event) => {
                updateFormValue('password', event.target.value, setFormValues);
              }}
              error={formErrors.password !== undefined}
              helperText={formErrors.password ?? 'Debe tener entre 8 y 72 caracteres.'}
              required
            />
            <TextField
              label="Rol"
              select
              value={formValues.role}
              onChange={(event) => {
                updateFormValue('role', event.target.value, setFormValues);
              }}
            >
              {userRoles.map((userRole) => (
                <MenuItem key={userRole} value={userRole}>
                  {getRoleLabel(userRole)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsCreateDialogOpen(false);
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="user-form"
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={isSubmitting}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={userToDeactivate !== null}
        onClose={
          isSubmitting
            ? undefined
            : () => {
                setUserToDeactivate(null);
              }
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Desactivar usuario</DialogTitle>
        <DialogContent>
          <Typography>
            El usuario <strong>{selectedUserName}</strong> no podra iniciar sesion mientras este
            inactivo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUserToDeactivate(null);
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={isSubmitting}
            onClick={() => {
              if (userToDeactivate !== null) {
                void handleStatusChange(userToDeactivate, false);
              }
            }}
          >
            Desactivar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function parseActiveFilter(value: 'true' | 'false' | ''): boolean | undefined {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

function updateFormValue(
  field: keyof UserPayload,
  value: string,
  setFormValues: Dispatch<SetStateAction<UserPayload>>,
): void {
  setFormValues((currentValues) => ({
    ...currentValues,
    [field]: value,
  }));
}

function validateUserForm(values: UserPayload): FormErrors {
  const errors: FormErrors = {};

  if (values.name.trim().length < 2) {
    errors.name = 'Ingrese al menos 2 caracteres.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Ingrese un email valido.';
  }

  if (values.password.length < 8 || values.password.length > 72) {
    errors.password = 'El password temporal debe tener entre 8 y 72 caracteres.';
  }

  return errors;
}
