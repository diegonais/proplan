import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <Stack spacing={3}>
      <Typography component="h1" variant="h1">
        Acceso no autorizado
      </Typography>
      <Alert severity="error">
        Su rol actual no permite acceder a esta sección. El backend validará nuevamente cada
        operación protegida.
      </Alert>
      <Button component={Link} to="/dashboard" variant="contained" sx={{ alignSelf: 'flex-start' }}>
        Volver al panel general
      </Button>
    </Stack>
  );
}
