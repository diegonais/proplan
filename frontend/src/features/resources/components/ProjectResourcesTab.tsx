import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { Project } from '../../projects/types';
import { listProjectTasks } from '../../tasks/services/tasksApi';
import { Task } from '../../tasks/types';
import { ResourceOperationalStatusChip } from './ResourceOperationalStatusChip';
import {
  createResourceAssignment,
  deleteResourceAssignment,
  listAvailableProjectResources,
  listProjectResourceAssignments,
  updateResourceAssignment,
} from '../services/resourcesApi';
import {
  Resource,
  ResourceAssignment,
  ResourceAssignmentPayload,
  ResourceAssignmentTemporalStatus,
  ResourceCategory,
  ResourceOperationalStatus,
  getResourceAssignmentTemporalStatusLabel,
  getResourceCategoryLabel,
} from '../types';

interface ProjectResourcesTabProps {
  project: Project;
  canManage: boolean;
  onAssignmentsChanged?: (assignments: ResourceAssignment[]) => void;
}

interface ResourceOption {
  uuid: string;
  code: string;
  name: string;
  category: ResourceCategory;
  operationalStatus: ResourceOperationalStatus;
}

interface AssignmentFormValues {
  resourceUuid: string;
  startDate: string;
  endDate: string;
  taskUuid: string;
  notes: string;
}

type AssignmentFormState =
  | {
      mode: 'create';
      assignment: null;
    }
  | {
      mode: 'edit';
      assignment: ResourceAssignment;
    };

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function ProjectResourcesTab({
  project,
  canManage,
  onAssignmentsChanged,
}: ProjectResourcesTabProps) {
  const { showNotification } = useNotifications();
  const [assignments, setAssignments] = useState<ResourceAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availableResources, setAvailableResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [isAvailableLoading, setIsAvailableLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formState, setFormState] = useState<AssignmentFormState | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<ResourceAssignment | null>(null);
  const [formValues, setFormValues] = useState<AssignmentFormValues>(
    createDefaultFormValues(project),
  );

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listProjectResourceAssignments(project.uuid);
      setAssignments(response);
      onAssignmentsChanged?.(response);
    } catch (requestError: unknown) {
      setAssignments([]);
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsLoading(false);
    }
  }, [onAssignmentsChanged, project.uuid]);

  const loadTasks = useCallback(async () => {
    if (!canManage) {
      return;
    }

    setIsTasksLoading(true);

    try {
      setTasks(await listProjectTasks(project.uuid));
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
      setTasks([]);
    } finally {
      setIsTasksLoading(false);
    }
  }, [canManage, project.uuid, showNotification]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.uuid === formValues.taskUuid) ?? null,
    [formValues.taskUuid, tasks],
  );
  const validationErrors = useMemo(
    () => validateFormValues(project, selectedTask, formValues),
    [formValues, project, selectedTask],
  );
  const hasValidAvailabilityQuery =
    formState !== null &&
    formValues.startDate.length > 0 &&
    formValues.endDate.length > 0 &&
    validationErrors.every(
      (validationError) =>
        validationError.field !== 'startDate' &&
        validationError.field !== 'endDate' &&
        validationError.field !== 'taskDateRange',
    );

  useEffect(() => {
    let isMounted = true;

    if (!hasValidAvailabilityQuery) {
      setAvailableResources([]);
      setAvailableError(null);
      setIsAvailableLoading(false);
      return;
    }

    setAvailableResources([]);
    setAvailableError(null);
    setIsAvailableLoading(true);

    void listAvailableProjectResources(project.uuid, {
      startDate: formValues.startDate,
      endDate: formValues.endDate,
      taskUuid: formValues.taskUuid || undefined,
    })
      .then((response) => {
        if (isMounted) {
          setAvailableResources(response);
        }
      })
      .catch((requestError: unknown) => {
        if (isMounted) {
          setAvailableError(getApiErrorMessage(requestError).message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAvailableLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    formState,
    formValues.endDate,
    formValues.startDate,
    formValues.taskUuid,
    hasValidAvailabilityQuery,
    project.uuid,
  ]);

  const resourceOptions = useMemo(
    () => buildResourceOptions(availableResources, formState?.assignment ?? null),
    [availableResources, formState],
  );

  useEffect(() => {
    if (formState === null || isAvailableLoading || formValues.resourceUuid.length === 0) {
      return;
    }

    const selectedResourceIsAvailable = resourceOptions.some(
      (resource) => resource.uuid === formValues.resourceUuid,
    );

    if (!selectedResourceIsAvailable) {
      setFormValues((currentValues) => ({ ...currentValues, resourceUuid: '' }));
    }
  }, [formState, formValues.resourceUuid, isAvailableLoading, resourceOptions]);

  const openCreateDialog = () => {
    setFormValues(createDefaultFormValues(project));
    setSubmitError(null);
    setAvailableError(null);
    setFormState({ mode: 'create', assignment: null });
  };

  const openEditDialog = (assignment: ResourceAssignment) => {
    setFormValues({
      resourceUuid: assignment.resourceUuid,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      taskUuid: assignment.taskUuid ?? '',
      notes: assignment.notes ?? '',
    });
    setSubmitError(null);
    setAvailableError(null);
    setFormState({ mode: 'edit', assignment });
  };

  const handleSubmit = async () => {
    if (formState === null || validationErrors.length > 0 || formValues.resourceUuid.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: ResourceAssignmentPayload = {
      resourceUuid: formValues.resourceUuid,
      startDate: formValues.startDate,
      endDate: formValues.endDate,
      taskUuid: formValues.taskUuid.length > 0 ? formValues.taskUuid : null,
      notes: formValues.notes.trim().length > 0 ? formValues.notes.trim() : null,
    };

    try {
      if (formState.mode === 'create') {
        await createResourceAssignment(project.uuid, payload);
        showNotification('Asignacion de recurso creada correctamente.', 'success');
      } else {
        await updateResourceAssignment(formState.assignment.uuid, payload);
        showNotification('Asignacion de recurso actualizada correctamente.', 'success');
      }

      setFormState(null);
      await loadAssignments();
    } catch (requestError: unknown) {
      const apiError = getApiErrorMessage(requestError);
      setSubmitError(
        apiError.statusCode === 409
          ? `${apiError.message} Revise el intervalo o seleccione otro recurso disponible.`
          : apiError.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (assignmentToDelete === null) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteResourceAssignment(assignmentToDelete.uuid);
      showNotification('Asignacion de recurso retirada logicamente.', 'success');
      setAssignmentToDelete(null);
      await loadAssignments();
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="h5">
            Recursos
          </Typography>
          <Typography color="text.secondary">
            Asignaciones de equipos, dispositivos, licencias y servicios del proyecto.
          </Typography>
        </Box>
        {canManage ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button component={Link} to="/resources" startIcon={<Inventory2OutlinedIcon />}>
              Catalogo
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              onClick={() => {
                void loadAssignments();
              }}
            >
              Actualizar
            </Button>
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreateDialog}>
              Nueva asignacion
            </Button>
          </Stack>
        ) : null}
      </Stack>

      {!canManage ? (
        <Alert severity="info">
          Vista de solo lectura. Puede consultar los recursos asignados al proyecto y sus
          actividades.
        </Alert>
      ) : null}

      {error !== null ? <Alert severity="error">{error}</Alert> : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        {isLoading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress aria-label="Cargando asignaciones de recursos" />
            <Typography color="text.secondary">Cargando asignaciones de recursos</Typography>
          </Stack>
        ) : (
          <Table aria-label="Recursos asignados al proyecto">
            <TableHead>
              <TableRow>
                <TableCell>Codigo</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Actividad asociada</TableCell>
                <TableCell>Fecha inicial</TableCell>
                <TableCell>Fecha final</TableCell>
                <TableCell>Estado temporal</TableCell>
                <TableCell>Estado operativo</TableCell>
                <TableCell>Asignado por</TableCell>
                <TableCell>Observaciones</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11}>
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <Typography color="text.secondary">
                        No hay recursos asignados a este proyecto.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((assignment) => (
                  <TableRow key={assignment.uuid} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{assignment.resource.code}</Typography>
                    </TableCell>
                    <TableCell>{assignment.resource.name}</TableCell>
                    <TableCell>{getResourceCategoryLabel(assignment.resource.category)}</TableCell>
                    <TableCell>{assignment.task?.name ?? 'Proyecto completo'}</TableCell>
                    <TableCell>{assignment.startDate}</TableCell>
                    <TableCell>{assignment.endDate}</TableCell>
                    <TableCell>
                      <TemporalStatusChip status={assignment.temporalStatus} />
                    </TableCell>
                    <TableCell>
                      <ResourceOperationalStatusChip status={assignment.resource.operationalStatus} />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography>{assignment.assignedBy.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {assignment.assignedBy.email}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{assignment.notes ?? 'Sin observaciones'}</TableCell>
                    <TableCell align="right">
                      {canManage ? (
                        <>
                          <Tooltip title="Editar asignacion">
                            <IconButton
                              aria-label="Editar asignacion"
                              onClick={() => {
                                openEditDialog(assignment);
                              }}
                            >
                              <EditOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Retirar asignacion">
                            <IconButton
                              color="error"
                              aria-label="Retirar asignacion"
                              onClick={() => {
                                setAssignmentToDelete(assignment);
                              }}
                            >
                              <DeleteOutlineOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Solo lectura
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <ResourceAssignmentFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        project={project}
        tasks={tasks}
        values={formValues}
        resourceOptions={resourceOptions}
        selectedTask={selectedTask}
        validationErrors={validationErrors}
        isTasksLoading={isTasksLoading}
        isAvailableLoading={isAvailableLoading}
        isSubmitting={isSubmitting}
        availableError={availableError}
        submitError={submitError}
        onChange={setFormValues}
        onCancel={() => {
          setFormState(null);
          setSubmitError(null);
        }}
        onSubmit={() => {
          void handleSubmit();
        }}
      />

      <DeleteResourceAssignmentDialog
        assignment={assignmentToDelete}
        isDeleting={isDeleting}
        onCancel={() => {
          setAssignmentToDelete(null);
        }}
        onConfirm={() => {
          void handleDeleteAssignment();
        }}
      />
    </Stack>
  );
}

interface ResourceAssignmentFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  project: Project;
  tasks: Task[];
  values: AssignmentFormValues;
  resourceOptions: ResourceOption[];
  selectedTask: Task | null;
  validationErrors: ValidationError[];
  isTasksLoading: boolean;
  isAvailableLoading: boolean;
  isSubmitting: boolean;
  availableError: string | null;
  submitError: string | null;
  onChange: (values: AssignmentFormValues) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

interface ValidationError {
  field: 'resourceUuid' | 'startDate' | 'endDate' | 'projectDateRange' | 'taskDateRange';
  message: string;
}

function ResourceAssignmentFormDialog({
  open,
  mode,
  project,
  tasks,
  values,
  resourceOptions,
  selectedTask,
  validationErrors,
  isTasksLoading,
  isAvailableLoading,
  isSubmitting,
  availableError,
  submitError,
  onChange,
  onCancel,
  onSubmit,
}: ResourceAssignmentFormDialogProps) {
  const resourceError = validationErrors.find((error) => error.field === 'resourceUuid');
  const startDateError = validationErrors.find((error) => error.field === 'startDate');
  const endDateError = validationErrors.find((error) => error.field === 'endDate');
  const projectDateRangeError = validationErrors.find(
    (error) => error.field === 'projectDateRange',
  );
  const taskDateRangeError = validationErrors.find((error) => error.field === 'taskDateRange');
  const canSubmit = validationErrors.length === 0 && !isSubmitting && !isAvailableLoading;

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>
        {mode === 'create' ? 'Crear asignacion de recurso' : 'Editar asignacion de recurso'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}
          {availableError !== null ? <Alert severity="warning">{availableError}</Alert> : null}
          <Alert severity="info">
            Rango del proyecto: {project.startDate} a {project.endDate}.
          </Alert>
          {selectedTask !== null ? (
            <Alert severity={taskDateRangeError === undefined ? 'info' : 'warning'}>
              Rango de la actividad seleccionada: {selectedTask.startDate} a {selectedTask.endDate}.
            </Alert>
          ) : null}
          {projectDateRangeError !== undefined ? (
            <Alert severity="warning">{projectDateRangeError.message}</Alert>
          ) : null}
          {taskDateRangeError !== undefined ? (
            <Alert severity="warning">{taskDateRangeError.message}</Alert>
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Fecha inicial"
              type="date"
              value={values.startDate}
              onChange={(event) => {
                onChange({ ...values, startDate: event.target.value });
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
              error={startDateError !== undefined}
              helperText={startDateError?.message}
            />
            <TextField
              label="Fecha final"
              type="date"
              value={values.endDate}
              onChange={(event) => {
                onChange({ ...values, endDate: event.target.value });
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
              error={endDateError !== undefined}
              helperText={endDateError?.message}
            />
          </Stack>

          <TextField
            label="Actividad"
            select
            value={values.taskUuid}
            onChange={(event) => {
              onChange({ ...values, taskUuid: event.target.value });
            }}
            disabled={isTasksLoading}
            helperText={isTasksLoading ? 'Cargando actividades' : 'Opcional'}
          >
            <MenuItem value="">Proyecto completo</MenuItem>
            {tasks.map((task) => (
              <MenuItem key={task.uuid} value={task.uuid}>
                {task.name} ({task.startDate} a {task.endDate})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Recurso"
            select
            value={values.resourceUuid}
            onChange={(event) => {
              onChange({ ...values, resourceUuid: event.target.value });
            }}
            required
            disabled={isAvailableLoading || resourceOptions.length === 0}
            error={resourceError !== undefined}
            helperText={
              resourceError?.message ??
              (isAvailableLoading
                ? 'Consultando recursos disponibles'
                : 'Solo se muestran recursos disponibles para el intervalo.')
            }
          >
            {resourceOptions.map((resource) => (
              <MenuItem key={resource.uuid} value={resource.uuid}>
                {resource.code} - {resource.name} - {getResourceCategoryLabel(resource.category)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Observaciones"
            value={values.notes}
            onChange={(event) => {
              onChange({ ...values, notes: event.target.value });
            }}
            multiline
            minRows={3}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={!canSubmit}>
          {isSubmitting ? 'Guardando' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface DeleteResourceAssignmentDialogProps {
  assignment: ResourceAssignment | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteResourceAssignmentDialog({
  assignment,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteResourceAssignmentDialogProps) {
  return (
    <Dialog open={assignment !== null} onClose={isDeleting ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Retirar asignacion</DialogTitle>
      <DialogContent>
        <Typography>
          Se retirara logicamente el recurso {assignment?.resource.code ?? 'seleccionado'} del
          proyecto.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting}>
          Cancelar
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? 'Retirando' : 'Retirar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TemporalStatusChip({ status }: { status: ResourceAssignmentTemporalStatus }) {
  const chipColor =
    status === 'ACTIVA' ? 'success' : status === 'PROGRAMADA' ? 'info' : 'default';

  return (
    <Chip
      label={getResourceAssignmentTemporalStatusLabel(status)}
      color={chipColor}
      size="small"
      variant={status === 'ACTIVA' ? 'filled' : 'outlined'}
    />
  );
}

function createDefaultFormValues(project: Project): AssignmentFormValues {
  return {
    resourceUuid: '',
    startDate: project.startDate,
    endDate: project.endDate,
    taskUuid: '',
    notes: '',
  };
}

function validateFormValues(
  project: Project,
  selectedTask: Task | null,
  values: AssignmentFormValues,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (values.startDate.length === 0 || !dateOnlyPattern.test(values.startDate)) {
    errors.push({
      field: 'startDate',
      message: 'La fecha inicial debe usar el formato YYYY-MM-DD.',
    });
  }

  if (values.endDate.length === 0 || !dateOnlyPattern.test(values.endDate)) {
    errors.push({
      field: 'endDate',
      message: 'La fecha final debe usar el formato YYYY-MM-DD.',
    });
  }

  if (
    dateOnlyPattern.test(values.startDate) &&
    dateOnlyPattern.test(values.endDate) &&
    values.endDate < values.startDate
  ) {
    errors.push({
      field: 'endDate',
      message: 'La fecha final no puede ser anterior a la fecha inicial.',
    });
  }

  if (
    dateOnlyPattern.test(values.startDate) &&
    dateOnlyPattern.test(values.endDate) &&
    (values.startDate < project.startDate || values.endDate > project.endDate)
  ) {
    errors.push({
      field: 'projectDateRange',
      message: 'Las fechas deben estar dentro del rango del proyecto.',
    });
  }

  if (
    selectedTask !== null &&
    dateOnlyPattern.test(values.startDate) &&
    dateOnlyPattern.test(values.endDate) &&
    (values.startDate < selectedTask.startDate || values.endDate > selectedTask.endDate)
  ) {
    errors.push({
      field: 'taskDateRange',
      message: 'Las fechas deben estar dentro del rango de la actividad seleccionada.',
    });
  }

  if (values.resourceUuid.length === 0) {
    errors.push({
      field: 'resourceUuid',
      message: 'Seleccione un recurso disponible.',
    });
  }

  return errors;
}

function buildResourceOptions(
  availableResources: readonly Resource[],
  currentAssignment: ResourceAssignment | null,
): ResourceOption[] {
  const options = new Map<string, ResourceOption>();

  availableResources.forEach((resource) => {
    options.set(resource.uuid, {
      uuid: resource.uuid,
      code: resource.code,
      name: resource.name,
      category: resource.category,
      operationalStatus: resource.operationalStatus,
    });
  });

  if (currentAssignment !== null) {
    options.set(currentAssignment.resource.uuid, {
      uuid: currentAssignment.resource.uuid,
      code: currentAssignment.resource.code,
      name: currentAssignment.resource.name,
      category: currentAssignment.resource.category,
      operationalStatus: currentAssignment.resource.operationalStatus,
    });
  }

  return Array.from(options.values()).sort((firstResource, secondResource) =>
    firstResource.code.localeCompare(secondResource.code),
  );
}
