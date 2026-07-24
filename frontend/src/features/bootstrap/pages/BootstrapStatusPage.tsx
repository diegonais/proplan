import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Alert, Paper, Stack, Typography } from '@mui/material';

import { formatInstantForDisplay } from '../../../utils/dateTime';
import { env } from '../../../utils/env';

export function BootstrapStatusPage() {
  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        p: { xs: 3, md: 4 },
      }}
    >
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CheckCircleOutlineIcon color="success" fontSize="large" aria-hidden="true" />
          <Stack spacing={0.5}>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
              Aplicacion inicializada correctamente
            </Typography>
            <Typography color="text.secondary">
              Base frontend disponible para la siguiente fase de desarrollo.
            </Typography>
          </Stack>
        </Stack>

        <Alert severity="info">
          Zona horaria funcional: {env.timeZone}. Hora de presentacion:{' '}
          {formatInstantForDisplay(new Date().toISOString())}.
        </Alert>
      </Stack>
    </Paper>
  );
}
