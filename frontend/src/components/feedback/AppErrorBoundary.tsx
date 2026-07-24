import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material';
import { Component, ErrorInfo, ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled frontend error', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 8 }}>
          <Container maxWidth="sm">
            <Stack spacing={3}>
              <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
                No se pudo cargar la interfaz
              </Typography>
              <Alert severity="error">
                Ocurrió un error inesperado. Recargue la página o vuelva a intentarlo más tarde.
              </Alert>
              <Button
                variant="contained"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Recargar
              </Button>
            </Stack>
          </Container>
        </Box>
      );
    }

    return this.props.children;
  }
}
