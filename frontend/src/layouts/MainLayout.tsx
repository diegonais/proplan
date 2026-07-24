import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { AppBar, Box, Container, Stack, Toolbar, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';

export function MainLayout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <CheckCircleOutlineIcon aria-hidden="true" />
            <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
              PROPLAN
            </Typography>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ py: { xs: 4, md: 6 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
