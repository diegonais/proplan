import { Box, Container, Skeleton, Stack } from '@mui/material';

export function LoadingScreen() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 8 }}>
      <Container maxWidth="md">
        <Stack spacing={2} aria-label="Cargando contenido">
          <Skeleton variant="rounded" height={48} />
          <Skeleton variant="rounded" height={180} />
          <Skeleton variant="rounded" height={96} />
        </Stack>
      </Container>
    </Box>
  );
}
