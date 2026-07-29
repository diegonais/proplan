import { Chip, Stack, Typography } from '@mui/material';

import {
  ResourceAvailability,
  ResourceUnavailableReason,
  getResourceUnavailableReasonLabel,
} from '../types';

interface ResourceAvailabilityChipProps {
  availability: ResourceAvailability | null | undefined;
  isLoading: boolean;
  hasDateRange: boolean;
}

export function ResourceAvailabilityChip({
  availability,
  isLoading,
  hasDateRange,
}: ResourceAvailabilityChipProps) {
  if (!hasDateRange) {
    return <Typography variant="body2">Seleccione fechas</Typography>;
  }

  if (isLoading) {
    return <Typography variant="body2">Consultando</Typography>;
  }

  if (availability === undefined) {
    return <Typography variant="body2">No se pudo consultar</Typography>;
  }

  if (availability === null) {
    return <Typography variant="body2">Sin resultado</Typography>;
  }

  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Chip
        label={availability.available ? 'Disponible' : 'No disponible'}
        color={availability.available ? 'success' : 'warning'}
        size="small"
        variant={availability.available ? 'filled' : 'outlined'}
      />
      {!availability.available && availability.unavailableReason !== null ? (
        <Typography variant="caption" color="text.secondary">
          {getShortUnavailableReasonLabel(availability.unavailableReason)}
        </Typography>
      ) : null}
    </Stack>
  );
}

function getShortUnavailableReasonLabel(reason: ResourceUnavailableReason): string {
  if (reason === 'ASSIGNMENT_CONFLICT') {
    return 'Asignacion superpuesta';
  }

  return getResourceUnavailableReasonLabel(reason);
}
