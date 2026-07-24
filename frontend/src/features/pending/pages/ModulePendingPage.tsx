import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { Alert, Paper, Stack, Typography } from '@mui/material';

interface ModulePendingPageProps {
  title: string;
}

export function ModulePendingPage({ title }: ModulePendingPageProps) {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h1">
          {title}
        </Typography>
        <Typography color="text.secondary">Módulo pendiente de implementación.</Typography>
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          <BuildOutlinedIcon color="primary" aria-hidden="true" />
          <Alert severity="info" sx={{ flexGrow: 1 }}>
            Esta sección todavía no contiene datos ni flujos funcionales. Se habilitará cuando se
            implemente el módulo correspondiente.
          </Alert>
        </Stack>
      </Paper>
    </Stack>
  );
}
