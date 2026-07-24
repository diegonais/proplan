import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Alert, Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
import { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  ManagerOption,
  Project,
  ProjectFormValues,
  ProjectPayload,
  getProjectStatusLabel,
  projectStatuses,
} from '../types';

interface ProjectFormProps {
  mode: 'create' | 'edit';
  project?: Project;
  isAdmin: boolean;
  managerOptions: readonly ManagerOption[];
  managerOptionsLoading: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (payload: ProjectPayload) => Promise<void>;
}

type ProjectFormErrors = Partial<Record<keyof ProjectFormValues, string>>;

const defaultValues: ProjectFormValues = {
  name: '',
  description: '',
  objective: '',
  startDate: '',
  endDate: '',
  status: 'PLANNING',
  approvedBudget: '0',
  managerUuid: '',
};

export function ProjectForm({
  mode,
  project,
  isAdmin,
  managerOptions,
  managerOptionsLoading,
  isSubmitting,
  submitError,
  onSubmit,
}: ProjectFormProps) {
  const initialValues = useMemo<ProjectFormValues>(
    () =>
      project === undefined
        ? defaultValues
        : {
            name: project.name,
            description: project.description ?? '',
            objective: project.objective,
            startDate: project.startDate,
            endDate: project.endDate,
            status: project.status,
            approvedBudget: project.approvedBudget,
            managerUuid: project.managerUuid,
          },
    [project],
  );
  const [values, setValues] = useState<ProjectFormValues>(initialValues);
  const [errors, setErrors] = useState<ProjectFormErrors>({});

  useEffect(() => {
    if (isAdmin && values.managerUuid.length === 0 && managerOptions.length === 1) {
      setValues((currentValues) => ({
        ...currentValues,
        managerUuid: managerOptions[0]?.uuid ?? '',
      }));
    }
  }, [isAdmin, managerOptions, values.managerUuid]);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateProjectForm(values, isAdmin);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    void onSubmit({
      name: values.name.trim(),
      description: values.description.trim().length > 0 ? values.description.trim() : null,
      objective: values.objective.trim(),
      startDate: values.startDate,
      endDate: values.endDate,
      status: values.status,
      approvedBudget: Number(values.approvedBudget),
      ...(isAdmin ? { managerUuid: values.managerUuid } : {}),
    });
  };

  const updateField = (field: keyof ProjectFormValues, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  return (
    <Paper
      elevation={0}
      component="form"
      onSubmit={handleSubmit}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 2, sm: 3 } }}
    >
      <Stack spacing={2.5}>
        {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}

        <TextField
          label="Nombre"
          value={values.name}
          onChange={(event) => {
            updateField('name', event.target.value);
          }}
          error={errors.name !== undefined}
          helperText={errors.name ?? 'Nombre visible del proyecto.'}
          required
        />

        <TextField
          label="Objetivo"
          value={values.objective}
          onChange={(event) => {
            updateField('objective', event.target.value);
          }}
          error={errors.objective !== undefined}
          helperText={errors.objective ?? 'Objetivo principal del proyecto.'}
          required
          multiline
          minRows={3}
        />

        <TextField
          label="Descripcion"
          value={values.description}
          onChange={(event) => {
            updateField('description', event.target.value);
          }}
          multiline
          minRows={3}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Fecha de inicio"
            type="date"
            value={values.startDate}
            onChange={(event) => {
              updateField('startDate', event.target.value);
            }}
            error={errors.startDate !== undefined}
            helperText={errors.startDate}
            slotProps={{ inputLabel: { shrink: true } }}
            required
          />
          <TextField
            label="Fecha de fin"
            type="date"
            value={values.endDate}
            onChange={(event) => {
              updateField('endDate', event.target.value);
            }}
            error={errors.endDate !== undefined}
            helperText={errors.endDate}
            slotProps={{ inputLabel: { shrink: true } }}
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
            {projectStatuses.map((status) => (
              <MenuItem key={status} value={status}>
                {getProjectStatusLabel(status)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Presupuesto aprobado"
            type="number"
            value={values.approvedBudget}
            onChange={(event) => {
              updateField('approvedBudget', event.target.value);
            }}
            error={errors.approvedBudget !== undefined}
            helperText={errors.approvedBudget ?? 'Monto no negativo.'}
            slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
            required
          />
        </Stack>

        {isAdmin ? (
          <TextField
            label="Jefe de proyecto"
            select
            value={values.managerUuid}
            onChange={(event) => {
              updateField('managerUuid', event.target.value);
            }}
            error={errors.managerUuid !== undefined}
            helperText={
              errors.managerUuid ??
              (managerOptionsLoading ? 'Cargando jefes disponibles.' : 'Seleccione un usuario activo.')
            }
            required
            disabled={managerOptionsLoading}
          >
            {managerOptions.map((manager) => (
              <MenuItem key={manager.uuid} value={manager.uuid}>
                {manager.name} ({manager.email})
              </MenuItem>
            ))}
          </TextField>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
          <Button component={Link} to={mode === 'edit' && project !== undefined ? `/projects/${project.uuid}` : '/projects'}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={isSubmitting}
          >
            {mode === 'create' ? 'Crear proyecto' : 'Guardar cambios'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function validateProjectForm(values: ProjectFormValues, isAdmin: boolean): ProjectFormErrors {
  const errors: ProjectFormErrors = {};

  if (values.name.trim().length === 0) {
    errors.name = 'El nombre es obligatorio.';
  }

  if (values.objective.trim().length === 0) {
    errors.objective = 'El objetivo es obligatorio.';
  }

  if (values.startDate.length === 0) {
    errors.startDate = 'La fecha de inicio es obligatoria.';
  }

  if (values.endDate.length === 0) {
    errors.endDate = 'La fecha de fin es obligatoria.';
  }

  if (values.startDate.length > 0 && values.endDate.length > 0 && values.endDate < values.startDate) {
    errors.endDate = 'La fecha de fin no puede ser anterior a la fecha de inicio.';
  }

  if (values.approvedBudget.length === 0 || Number.isNaN(Number(values.approvedBudget))) {
    errors.approvedBudget = 'Ingrese un presupuesto valido.';
  } else if (Number(values.approvedBudget) < 0) {
    errors.approvedBudget = 'El presupuesto aprobado no puede ser negativo.';
  }

  if (isAdmin && values.managerUuid.length === 0) {
    errors.managerUuid = 'Seleccione un jefe de proyecto.';
  }

  return errors;
}
