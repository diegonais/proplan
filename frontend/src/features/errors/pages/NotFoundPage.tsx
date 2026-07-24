import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Stack spacing={3}>
      <Typography component="h1" variant="h1">
        Página no encontrada
      </Typography>
      <Alert severity="warning">
        La ruta solicitada no existe o ya no está disponible en PROPLAN.
      </Alert>
      <Button component={Link} to="/dashboard" variant="contained" sx={{ alignSelf: 'flex-start' }}>
        Volver al panel general
      </Button>
    </Stack>
  );
}
