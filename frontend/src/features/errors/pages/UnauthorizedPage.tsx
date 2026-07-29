import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

import { getDefaultAuthenticatedPath } from '../../../app/router/defaultRoute';
import { useAuth } from '../../auth/authContext';

export function UnauthorizedPage() {
  const { user } = useAuth();
  const defaultPath = getDefaultAuthenticatedPath(user?.role ?? 'USER');

  return (
    <Stack spacing={3}>
      <Typography component="h1" variant="h1">
        Acceso no autorizado
      </Typography>
      <Alert severity="error">
        Su rol actual no permite acceder a esta sección. El backend validará nuevamente cada
        operación protegida.
      </Alert>
      <Button component={Link} to={defaultPath} variant="contained" sx={{ alignSelf: 'flex-start' }}>
        Volver a una seccion permitida
      </Button>
    </Stack>
  );
}
