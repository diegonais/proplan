import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Box, Container, Stack, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';

import { ThemeModeButton } from '../components/navigation/ThemeModeButton';

export function PublicLayout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container
        component="main"
        maxWidth="sm"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          py: 4,
        }}
      >
        <Stack spacing={4} sx={{ width: '100%' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CheckCircleOutlineIcon color="primary" aria-hidden="true" />
              <Typography component="p" variant="h6" sx={{ fontWeight: 700 }}>
                PROPLAN
              </Typography>
            </Stack>
            <ThemeModeButton />
          </Stack>
          <Outlet />
        </Stack>
      </Container>
    </Box>
  );
}
