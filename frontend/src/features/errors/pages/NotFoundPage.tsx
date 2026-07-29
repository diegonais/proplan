import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

import { getDefaultAuthenticatedPath } from '../../../app/router/defaultRoute';
import { useAuth } from '../../auth/authContext';

export function NotFoundPage() {
  const { user } = useAuth();
  const defaultPath = getDefaultAuthenticatedPath(user?.role ?? 'USER');

  return (
    <Stack spacing={3}>
      <Typography component="h1" variant="h1">
        Página no encontrada
      </Typography>
      <Alert severity="warning">
        La ruta solicitada no existe o ya no está disponible en PROPLAN.
      </Alert>
      <Button component={Link} to={defaultPath} variant="contained" sx={{ alignSelf: 'flex-start' }}>
        Volver a una seccion permitida
      </Button>
    </Stack>
  );
}
