import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { SyntheticEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../authContext';

interface LoginFormState {
  email: string;
  password: string;
}

interface LoginFormErrors {
  email?: string;
  password?: string;
}

const initialFormState: LoginFormState = {
  email: '',
  password: '',
};

export function LoginPage() {
  const [formState, setFormState] = useState<LoginFormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<LoginFormErrors>({});
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const hasFieldErrors = useMemo(
    () => Object.values(formErrors).some((message) => message !== undefined),
    [formErrors],
  );

  function updateField(field: keyof LoginFormState, value: string): void {
    setFormState((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setBackendError(null);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const validationErrors = validateLoginForm(formState);
    setFormErrors(validationErrors);
    setBackendError(null);

    if (Object.values(validationErrors).some((message) => message !== undefined)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: formState.email.trim().toLowerCase(),
        password: formState.password,
      });
      void navigate('/dashboard', { replace: true });
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        p: { xs: 3, sm: 4 },
      }}
    >
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <LockOutlinedIcon aria-hidden="true" />
          </Box>
          <Typography component="h1" variant="h1">
            Inicio de sesión
          </Typography>
          <Typography color="text.secondary">
            Ingrese con las credenciales asignadas para acceder a PROPLAN.
          </Typography>
        </Stack>

        {backendError !== null ? <Alert severity="error">{backendError}</Alert> : null}

        <Box
          component="form"
          noValidate
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <Stack spacing={2.5}>
            <TextField
              id="email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={formState.email}
              onChange={(event) => {
                updateField('email', event.target.value);
              }}
              error={formErrors.email !== undefined}
              helperText={formErrors.email ?? 'Use el email registrado en el sistema.'}
              disabled={isSubmitting}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              id="password"
              name="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={formState.password}
              onChange={(event) => {
                updateField('password', event.target.value);
              }}
              error={formErrors.password !== undefined}
              helperText={formErrors.password ?? 'Debe contener al menos 8 caracteres.'}
              disabled={isSubmitting}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting || hasFieldErrors}
              startIcon={isSubmitting ? <CircularProgress color="inherit" size={18} /> : null}
            >
              {isSubmitting ? 'Ingresando' : 'Ingresar'}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function validateLoginForm(formState: LoginFormState): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const email = formState.email.trim();

  if (email.length === 0) {
    errors.email = 'El email es obligatorio.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Ingrese un email válido.';
  }

  if (formState.password.length === 0) {
    errors.password = 'La contraseña es obligatoria.';
  } else if (formState.password.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.';
  }

  return errors;
}
