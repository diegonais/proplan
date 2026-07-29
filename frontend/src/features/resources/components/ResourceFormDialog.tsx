import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { SyntheticEvent, useEffect, useMemo, useState } from 'react';

import {
  Resource,
  ResourceCategory,
  ResourceOperationalStatus,
  ResourcePayload,
  getResourceCategoryLabel,
  getResourceOperationalStatusLabel,
  resourceCategories,
  resourceOperationalStatuses,
} from '../types';

export interface ResourceFormValues {
  name: string;
  code: string;
  description: string;
  category: ResourceCategory;
  serialNumber: string;
  operationalStatus: ResourceOperationalStatus;
  notes: string;
  isActive: boolean;
}

interface ResourceFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  resource: Resource | null;
  isSubmitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (values: ResourceFormValues, payload: ResourcePayload) => Promise<void>;
}

type ResourceFormErrors = Partial<Record<keyof ResourceFormValues, string>>;

const defaultValues: ResourceFormValues = {
  name: '',
  code: '',
  description: '',
  category: 'LAPTOP',
  serialNumber: '',
  operationalStatus: 'OPERATIONAL',
  notes: '',
  isActive: true,
};

export function ResourceFormDialog({
  open,
  mode,
  resource,
  isSubmitting,
  submitError,
  onClose,
  onSubmit,
}: ResourceFormDialogProps) {
  const initialValues = useMemo<ResourceFormValues>(
    () =>
      resource === null
        ? defaultValues
        : {
            name: resource.name,
            code: resource.code,
            description: resource.description ?? '',
            category: resource.category,
            serialNumber: resource.serialNumber ?? '',
            operationalStatus: resource.operationalStatus,
            notes: resource.notes ?? '',
            isActive: resource.isActive,
          },
    [resource],
  );
  const [values, setValues] = useState<ResourceFormValues>(initialValues);
  const [errors, setErrors] = useState<ResourceFormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
  }, [initialValues, open]);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateResourceForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    void onSubmit(values, {
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      description: normalizeOptionalText(values.description),
      category: values.category,
      serialNumber: normalizeOptionalText(values.serialNumber),
      operationalStatus: values.operationalStatus,
      notes: normalizeOptionalText(values.notes),
    });
  };

  const updateField = <Field extends keyof ResourceFormValues>(
    field: Field,
    value: ResourceFormValues[Field],
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{mode === 'create' ? 'Crear recurso' : 'Editar recurso'}</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id="resource-form"
          spacing={2.5}
          onSubmit={handleSubmit}
          sx={{ pt: 1 }}
        >
          {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Nombre"
              value={values.name}
              onChange={(event) => {
                updateField('name', event.target.value);
              }}
              error={errors.name !== undefined}
              helperText={errors.name ?? 'Nombre visible del recurso.'}
              required
            />
            <TextField
              label="Codigo"
              value={values.code}
              onChange={(event) => {
                updateField('code', event.target.value);
              }}
              error={errors.code !== undefined}
              helperText={errors.code ?? 'Codigo interno unico.'}
              required
            />
          </Stack>

          <TextField
            label="Descripcion"
            value={values.description}
            onChange={(event) => {
              updateField('description', event.target.value);
            }}
            error={errors.description !== undefined}
            helperText={errors.description}
            multiline
            minRows={3}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Categoria"
              select
              value={values.category}
              onChange={(event) => {
                updateField('category', event.target.value as ResourceCategory);
              }}
            >
              {resourceCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {getResourceCategoryLabel(category)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Numero de serie"
              value={values.serialNumber}
              onChange={(event) => {
                updateField('serialNumber', event.target.value);
              }}
              error={errors.serialNumber !== undefined}
              helperText={errors.serialNumber}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Estado operativo"
              select
              value={values.operationalStatus}
              onChange={(event) => {
                updateField('operationalStatus', event.target.value as ResourceOperationalStatus);
              }}
            >
              {resourceOperationalStatuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {getResourceOperationalStatusLabel(status)}
                </MenuItem>
              ))}
            </TextField>
            {mode === 'edit' ? (
              <FormControlLabel
                control={
                  <Switch
                    checked={values.isActive}
                    onChange={(event) => {
                      setValues((currentValues) => ({
                        ...currentValues,
                        isActive: event.target.checked,
                      }));
                    }}
                  />
                }
                label={values.isActive ? 'Recurso activo' : 'Recurso inactivo'}
                sx={{ alignSelf: { sm: 'center' }, minWidth: 220 }}
              />
            ) : null}
          </Stack>

          <TextField
            label="Notas"
            value={values.notes}
            onChange={(event) => {
              updateField('notes', event.target.value);
            }}
            error={errors.notes !== undefined}
            helperText={errors.notes}
            multiline
            minRows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="resource-form"
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

function normalizeOptionalText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function validateResourceForm(values: ResourceFormValues): ResourceFormErrors {
  const errors: ResourceFormErrors = {};

  if (values.name.trim().length < 2) {
    errors.name = 'Ingrese al menos 2 caracteres.';
  }

  if (values.name.trim().length > 160) {
    errors.name = 'Ingrese como maximo 160 caracteres.';
  }

  if (values.code.trim().length < 2) {
    errors.code = 'Ingrese al menos 2 caracteres.';
  }

  if (values.code.trim().length > 80) {
    errors.code = 'Ingrese como maximo 80 caracteres.';
  }

  if (values.description.trim().length > 1000) {
    errors.description = 'Ingrese como maximo 1000 caracteres.';
  }

  if (values.serialNumber.trim().length > 120) {
    errors.serialNumber = 'Ingrese como maximo 120 caracteres.';
  }

  if (values.notes.trim().length > 1000) {
    errors.notes = 'Ingrese como maximo 1000 caracteres.';
  }

  return errors;
}
