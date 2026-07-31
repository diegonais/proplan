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
import { SyntheticEvent, useEffect, useMemo, useState } from 'react';

import { isValidMoneyInput, normalizeMoneyInput } from '../../../utils/money';
import {
  Task,
  TaskFormValues,
  TaskPayload,
  getTaskStatusLabel,
  taskStatuses,
} from '../types';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface TaskFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  taskKind: 'activity' | 'subactivity';
  projectDateRange: DateRange;
  tasks: readonly Task[];
  task?: Task | null;
  parentTaskUuid?: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onCancel: () => void;
  onSubmit: (payload: TaskPayload) => Promise<void>;
}

type TaskFormErrors = Partial<Record<keyof TaskFormValues, string>>;

const emptyValues: TaskFormValues = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  status: 'PENDING',
  progress: '0',
  estimatedHours: '0',
  plannedBudget: '0',
  actualCost: '0',
  parentTaskUuid: '',
};

export function TaskFormDialog({
  open,
  mode,
  taskKind,
  projectDateRange,
  tasks,
  task,
  parentTaskUuid,
  isSubmitting,
  submitError,
  onCancel,
  onSubmit,
}: TaskFormDialogProps) {
  const initialValues = useMemo<TaskFormValues>(() => {
    if (task !== undefined && task !== null) {
      return {
        name: task.name,
        description: task.description ?? '',
        startDate: task.startDate,
        endDate: task.endDate,
        status: task.status,
        progress: String(task.progress),
        estimatedHours: task.estimatedHours,
        plannedBudget: task.plannedBudget ?? '0.00',
        actualCost: task.actualCost ?? '0.00',
        parentTaskUuid: taskKind === 'subactivity' ? task.parentTaskUuid ?? '' : '',
      };
    }

    return {
      ...emptyValues,
      parentTaskUuid: taskKind === 'subactivity' ? parentTaskUuid ?? '' : '',
    };
  }, [parentTaskUuid, task, taskKind]);
  const [values, setValues] = useState<TaskFormValues>(initialValues);
  const [errors, setErrors] = useState<TaskFormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
  }, [initialValues, open]);

  const parentOptions = tasks.filter(
    (candidate) => candidate.parentTaskUuid === null && candidate.uuid !== task?.uuid,
  );
  const selectedParentTask =
    taskKind === 'subactivity'
      ? tasks.find((candidate) => candidate.uuid === values.parentTaskUuid) ?? null
      : null;
  const allowedDateRange =
    taskKind === 'activity'
      ? projectDateRange
      : selectedParentTask === null
        ? null
        : {
            startDate: selectedParentTask.startDate,
            endDate: selectedParentTask.endDate,
          };

  const updateField = (field: keyof TaskFormValues, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateTaskForm(values, taskKind, allowedDateRange);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    void onSubmit({
      name: values.name.trim(),
      description: values.description.trim().length > 0 ? values.description.trim() : null,
      startDate: values.startDate,
      endDate: values.endDate,
      status: values.status,
      progress: Number(values.progress),
      estimatedHours: Number(values.estimatedHours),
      plannedBudget: normalizeMoneyInput(values.plannedBudget),
      actualCost: normalizeMoneyInput(values.actualCost),
      parentTaskUuid: taskKind === 'subactivity' ? values.parentTaskUuid : null,
    });
  };

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onCancel} fullWidth maxWidth="md">
      <DialogTitle>{getDialogTitle(mode, taskKind)}</DialogTitle>
      <DialogContent>
        <Stack component="form" id="task-form" spacing={2.5} onSubmit={handleSubmit} sx={{ pt: 1 }}>
          {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}

          <TextField
            label="Nombre"
            value={values.name}
            onChange={(event) => {
              updateField('name', event.target.value);
            }}
            error={errors.name !== undefined}
            helperText={errors.name ?? 'Nombre visible de la actividad.'}
            required
          />

          <TextField
            label="Descripcion"
            value={values.description}
            onChange={(event) => {
              updateField('description', event.target.value);
            }}
            multiline
            minRows={2}
          />

          {taskKind === 'subactivity' ? (
            <TextField
              label="Actividad padre"
              select
              value={values.parentTaskUuid}
              onChange={(event) => {
                updateField('parentTaskUuid', event.target.value);
              }}
              error={errors.parentTaskUuid !== undefined}
              helperText={errors.parentTaskUuid ?? 'Seleccione una actividad padre de primer nivel.'}
              required
            >
              <MenuItem value="" disabled>
                {parentOptions.length > 0 ? 'Seleccione una actividad padre' : 'Primero cree una actividad'}
              </MenuItem>
              {parentOptions.map((parentOption) => (
                <MenuItem key={parentOption.uuid} value={parentOption.uuid}>
                  {parentOption.name}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          <Alert severity="info">{getDateRangeMessage(taskKind, allowedDateRange)}</Alert>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Fecha inicial"
              type="date"
              value={values.startDate}
              onChange={(event) => {
                updateField('startDate', event.target.value);
              }}
              error={errors.startDate !== undefined}
              helperText={errors.startDate}
              slotProps={getDateInputSlotProps(allowedDateRange)}
              required
            />
            <TextField
              label="Fecha final"
              type="date"
              value={values.endDate}
              onChange={(event) => {
                updateField('endDate', event.target.value);
              }}
              error={errors.endDate !== undefined}
              helperText={errors.endDate}
              slotProps={getDateInputSlotProps(allowedDateRange)}
              required
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Estado"
              select
              value={values.status}
              onChange={(event) => {
                updateField('status', event.target.value);
              }}
            >
              {taskStatuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {getTaskStatusLabel(status)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Progreso"
              type="number"
              value={values.progress}
              onChange={(event) => {
                updateField('progress', event.target.value);
              }}
              error={errors.progress !== undefined}
              helperText={errors.progress ?? 'Valor entre 0 y 100.'}
              slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
              required
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Horas estimadas"
              type="number"
              value={values.estimatedHours}
              onChange={(event) => {
                updateField('estimatedHours', event.target.value);
              }}
              error={errors.estimatedHours !== undefined}
              helperText={errors.estimatedHours ?? 'Valor no negativo.'}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              required
            />
            <TextField
              label="Presupuesto planificado"
              type="number"
              value={values.plannedBudget}
              onChange={(event) => {
                updateField('plannedBudget', event.target.value);
              }}
              error={errors.plannedBudget !== undefined}
              helperText={errors.plannedBudget ?? 'Monto no negativo.'}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              required
            />
            <TextField
              label="Costo ejecutado"
              type="number"
              value={values.actualCost}
              onChange={(event) => {
                updateField('actualCost', event.target.value);
              }}
              error={errors.actualCost !== undefined}
              helperText={errors.actualCost ?? 'Monto no negativo.'}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              required
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="task-form"
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

function validateTaskForm(
  values: TaskFormValues,
  taskKind: 'activity' | 'subactivity',
  allowedDateRange: DateRange | null,
): TaskFormErrors {
  const errors: TaskFormErrors = {};

  if (values.name.trim().length === 0) {
    errors.name = 'El nombre es obligatorio.';
  }

  if (taskKind === 'subactivity' && values.parentTaskUuid.length === 0) {
    errors.parentTaskUuid = 'Seleccione una actividad padre.';
  }

  if (values.startDate.length === 0) {
    errors.startDate = 'La fecha inicial es obligatoria.';
  }

  if (values.endDate.length === 0) {
    errors.endDate = 'La fecha final es obligatoria.';
  }

  if (values.startDate.length > 0 && values.endDate.length > 0 && values.endDate < values.startDate) {
    errors.endDate = 'La fecha final no puede ser anterior a la fecha inicial.';
  }

  if (allowedDateRange !== null) {
    if (
      values.startDate.length > 0 &&
      (values.startDate < allowedDateRange.startDate || values.startDate > allowedDateRange.endDate)
    ) {
      errors.startDate = `La fecha inicial debe estar entre ${allowedDateRange.startDate} y ${allowedDateRange.endDate}.`;
    }

    if (
      values.endDate.length > 0 &&
      (values.endDate < allowedDateRange.startDate || values.endDate > allowedDateRange.endDate)
    ) {
      errors.endDate = `La fecha final debe estar entre ${allowedDateRange.startDate} y ${allowedDateRange.endDate}.`;
    }
  }

  validateNonNegativeNumber(values.estimatedHours, 'estimatedHours', errors);
  validateMoneyField(values.plannedBudget, 'plannedBudget', errors);
  validateMoneyField(values.actualCost, 'actualCost', errors);

  if (values.progress.length === 0 || Number.isNaN(Number(values.progress))) {
    errors.progress = 'Ingrese un progreso valido.';
  } else if (Number(values.progress) < 0 || Number(values.progress) > 100) {
    errors.progress = 'El progreso debe estar entre 0 y 100.';
  }

  if (values.status === 'COMPLETED' && Number(values.progress) !== 100) {
    errors.progress = 'Una actividad completada debe tener progreso 100.';
  }

  return errors;
}

function getDialogTitle(mode: 'create' | 'edit', taskKind: 'activity' | 'subactivity'): string {
  if (mode === 'create') {
    return taskKind === 'activity' ? 'Crear actividad' : 'Crear subactividad';
  }

  return taskKind === 'activity' ? 'Editar actividad' : 'Editar subactividad';
}

function getDateRangeMessage(
  taskKind: 'activity' | 'subactivity',
  allowedDateRange: DateRange | null,
): string {
  if (allowedDateRange === null) {
    return 'Seleccione una actividad padre para consultar el rango de fechas permitido.';
  }

  const subject = taskKind === 'activity' ? 'Rango del proyecto' : 'Rango de la actividad padre';

  return `${subject}: ${allowedDateRange.startDate} a ${allowedDateRange.endDate}.`;
}

function getDateInputSlotProps(allowedDateRange: DateRange | null) {
  return {
    inputLabel: { shrink: true },
    htmlInput:
      allowedDateRange === null
        ? {}
        : {
            min: allowedDateRange.startDate,
            max: allowedDateRange.endDate,
          },
  };
}

function validateNonNegativeNumber(
  value: string,
  field: 'estimatedHours',
  errors: TaskFormErrors,
): void {
  if (value.length === 0 || Number.isNaN(Number(value))) {
    errors[field] = 'Ingrese un valor valido.';
    return;
  }

  if (Number(value) < 0) {
    errors[field] = 'El valor no puede ser negativo.';
  }
}

function validateMoneyField(
  value: string,
  field: 'plannedBudget' | 'actualCost',
  errors: TaskFormErrors,
): void {
  if (!isValidMoneyInput(value)) {
    errors[field] = 'Ingrese un monto valido con maximo 2 decimales.';
  }
}
