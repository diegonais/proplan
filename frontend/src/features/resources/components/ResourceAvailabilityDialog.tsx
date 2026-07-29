import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';

import {
  Resource,
  ResourceAvailability,
  getResourceUnavailableReasonLabel,
} from '../types';

interface ResourceAvailabilityDialogProps {
  open: boolean;
  resource: Resource | null;
  startDate: string;
  endDate: string;
  availability: ResourceAvailability | null | undefined;
  onClose: () => void;
}

export function ResourceAvailabilityDialog({
  open,
  resource,
  startDate,
  endDate,
  availability,
  onClose,
}: ResourceAvailabilityDialogProps) {
  const title = resource === null ? 'Disponibilidad' : `Disponibilidad de ${resource.code}`;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {resource !== null ? (
            <Typography>
              {resource.name} para el intervalo {startDate} a {endDate}.
            </Typography>
          ) : null}

          {availability === undefined ? (
            <Alert severity="error">No se pudo consultar la disponibilidad del recurso.</Alert>
          ) : null}

          {availability === null ? (
            <Alert severity="info">Seleccione un intervalo de fechas para consultar disponibilidad.</Alert>
          ) : null}

          {availability !== null && availability !== undefined ? (
            <Alert severity={availability.available ? 'success' : 'warning'}>
              {availability.available
                ? 'El recurso esta disponible para el intervalo consultado.'
                : getUnavailableText(availability)}
            </Alert>
          ) : null}

          {availability?.conflicts.length ? (
            <Stack spacing={1}>
              <Typography component="h3" variant="h6">
                Asignaciones en conflicto
              </Typography>
              {availability.conflicts.map((conflict) => (
                <Stack key={conflict.uuid} spacing={0.25}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {conflict.startDate} a {conflict.endDate}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Proyecto: {conflict.projectUuid}
                    {conflict.taskUuid !== null ? `, actividad: ${conflict.taskUuid}` : ''}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : null}

          {availability?.unavailableReason === 'ASSIGNMENT_CONFLICT' &&
          availability.conflicts.length === 0 ? (
            <Typography color="text.secondary">
              Hay una asignacion superpuesta, pero su rol no permite ver el detalle completo del
              proyecto asociado.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

function getUnavailableText(availability: ResourceAvailability): string {
  if (availability.unavailableReason === null) {
    return 'El recurso no esta disponible para el intervalo consultado.';
  }

  return getResourceUnavailableReasonLabel(availability.unavailableReason);
}
