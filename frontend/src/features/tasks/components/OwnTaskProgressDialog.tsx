import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { SyntheticEvent, useEffect, useState } from 'react';

import { Task, TaskProgressPayload, getTaskStatusLabel, taskStatuses } from '../types';

interface OwnTaskProgressDialogProps {
  open: boolean;
  task: Task | null;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (payload: TaskProgressPayload) => Promise<void>;
}

export function OwnTaskProgressDialog({
  open,
  task,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
}: OwnTaskProgressDialogProps) {
  const [status, setStatus] = useState(task?.status ?? 'PENDING');
  const [progress, setProgress] = useState(String(task?.progress ?? 0));
  const [progressError, setProgressError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus(task?.status ?? 'PENDING');
      setProgress(String(task?.progress ?? 0));
      setProgressError(null);
    }
  }, [open, task]);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (progress.length === 0 || Number.isNaN(Number(progress))) {
      setProgressError('Ingrese un progreso valido.');
      return;
    }

    if (Number(progress) < 0 || Number(progress) > 100) {
      setProgressError('El progreso debe estar entre 0 y 100.');
      return;
    }

    if (status === 'COMPLETED' && Number(progress) !== 100) {
      setProgressError('Una actividad completada debe tener progreso 100.');
      return;
    }

    setProgressError(null);
    void onSubmit({ status, progress: Number(progress) });
  };

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Actualizar avance</DialogTitle>
      <DialogContent>
        <Stack component="form" id="own-task-progress-form" spacing={2.5} onSubmit={handleSubmit} sx={{ pt: 1 }}>
          {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}

          <TextField
            label="Estado"
            select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as TaskProgressPayload['status']);
            }}
          >
            {taskStatuses.map((taskStatus) => (
              <MenuItem key={taskStatus} value={taskStatus}>
                {getTaskStatusLabel(taskStatus)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Progreso"
            type="number"
            value={progress}
            onChange={(event) => {
              setProgress(event.target.value);
            }}
            error={progressError !== null}
            helperText={progressError ?? 'Solo estado y progreso pueden actualizarse desde esta accion.'}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="own-task-progress-form"
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          disabled={isSubmitting}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
