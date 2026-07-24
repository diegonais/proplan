import { Alert, Paper, Stack, Typography } from '@mui/material';

import { useAuth } from '../../auth/authContext';
import { getRoleLabel } from '../../auth/types';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h1">
          Panel general
        </Typography>
        <Typography color="text.secondary">
          Vista inicial de navegación para los módulos autorizados de PROPLAN.
        </Typography>
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h2">
            Sesión activa
          </Typography>
          <Typography>
            {user?.name ?? 'Usuario'} accedió con el rol {user ? getRoleLabel(user.role) : ''}.
          </Typography>
          <Alert severity="info">
            Las pantallas funcionales de proyectos, actividades, equipo, presupuestos y reportes se
            implementarán en fases posteriores.
          </Alert>
        </Stack>
      </Paper>
    </Stack>
  );
}
