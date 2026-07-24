import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import {
  formatMoney,
  formatPercentage,
  isValidMoneyInput,
  normalizeMoneyInput,
} from '../../../utils/money';
import { updateTaskFinancials } from '../../tasks/services/tasksApi';
import { getTaskStatusLabel } from '../../tasks/types';
import {
  getProjectFinancialSummary,
  updateProjectBudget,
} from '../services/projectsApi';
import { Project, ProjectFinancialSummary, ProjectFinancialTaskSummary } from '../types';

interface ProjectBudgetTabProps {
  project: Project;
  canManage: boolean;
  onProjectUpdated: (project: Project) => void;
}

type FinancialFormErrors = Partial<Record<'approvedBudget' | 'plannedBudget' | 'actualCost', string>>;

export function ProjectBudgetTab({ project, canManage, onProjectUpdated }: ProjectBudgetTabProps) {
  const { showNotification } = useNotifications();
  const [summary, setSummary] = useState<ProjectFinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState(project.approvedBudget ?? '0.00');
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ProjectFinancialTaskSummary | null>(null);
  const [taskValues, setTaskValues] = useState({ plannedBudget: '0.00', actualCost: '0.00' });
  const [formErrors, setFormErrors] = useState<FinancialFormErrors>({});

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getProjectFinancialSummary(project.uuid);
      setSummary(response);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [project.uuid]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    setBudgetValue(project.approvedBudget ?? '0.00');
  }, [project.approvedBudget]);

  const metrics = useMemo(
    () =>
      summary === null
        ? []
        : [
            { label: 'Presupuesto aprobado', value: formatMoney(summary.approvedBudget) },
            { label: 'Presupuesto distribuido', value: formatMoney(summary.distributedBudget) },
            { label: 'Costo ejecutado', value: formatMoney(summary.totalActualCost) },
            { label: 'Saldo', value: formatMoney(summary.balance) },
            { label: 'Porcentaje consumido', value: formatPercentage(summary.consumedPercentage) },
            {
              label: 'Diferencia distribuido-aprobado',
              value: formatMoney(summary.distributedBudgetDifference),
            },
          ],
    [summary],
  );

  const handleBudgetSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FinancialFormErrors = {};

    if (!isValidMoneyInput(budgetValue)) {
      nextErrors.approvedBudget = 'Ingrese un monto valido con maximo 2 decimales.';
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const updatedProject = await updateProjectBudget(project.uuid, normalizeMoneyInput(budgetValue));
      onProjectUpdated(updatedProject);
      showNotification('Presupuesto aprobado actualizado correctamente.', 'success');
      setBudgetDialogOpen(false);
      await loadSummary();
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTaskSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FinancialFormErrors = {};

    if (!isValidMoneyInput(taskValues.plannedBudget)) {
      nextErrors.plannedBudget = 'Ingrese un presupuesto valido con maximo 2 decimales.';
    }

    if (!isValidMoneyInput(taskValues.actualCost)) {
      nextErrors.actualCost = 'Ingrese un costo valido con maximo 2 decimales.';
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || taskToEdit === null) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await updateTaskFinancials(taskToEdit.uuid, {
        plannedBudget: normalizeMoneyInput(taskValues.plannedBudget),
        actualCost: normalizeMoneyInput(taskValues.actualCost),
      });
      showNotification('Valores financieros de la actividad actualizados correctamente.', 'success');
      setTaskToEdit(null);
      await loadSummary();
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress aria-label="Cargando presupuesto del proyecto" />
        <Typography color="text.secondary">Cargando presupuesto</Typography>
      </Stack>
    );
  }

  if (error !== null || summary === null) {
    return <Alert severity="error">{error ?? 'No se pudo cargar el resumen financiero.'}</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="h5">
            Presupuesto
          </Typography>
          <Typography color="text.secondary">{summary.operationalBudgetPolicy}</Typography>
        </Box>
        {canManage ? (
          <Button
            variant="contained"
            startIcon={<EditOutlinedIcon />}
            onClick={() => {
              setBudgetValue(summary.approvedBudget);
              setSubmitError(null);
              setFormErrors({});
              setBudgetDialogOpen(true);
            }}
          >
            Editar aprobado
          </Button>
        ) : null}
      </Stack>

      {summary.budgetExceeded ? (
        <Alert severity="warning">
          El costo ejecutado supera el presupuesto aprobado. Revise los costos por actividad.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, 1fr)' },
        }}
      >
        {metrics.map((metric) => (
          <Paper key={metric.label} elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {metric.label}
            </Typography>
            <Typography variant="h6">{metric.value}</Typography>
          </Paper>
        ))}
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Table aria-label="Presupuesto por actividad">
          <TableHead>
            <TableRow>
              <TableCell>Actividad</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Presupuesto planificado</TableCell>
              <TableCell align="right">Costo ejecutado</TableCell>
              <TableCell align="right">Variacion</TableCell>
              <TableCell align="right">Consumido</TableCell>
              {canManage ? <TableCell align="right">Acciones</TableCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {summary.tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6}>
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No hay actividades operativas con presupuesto en este proyecto.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              summary.tasks.map((task) => (
                <TableRow key={task.uuid} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700 }}>{task.name}</Typography>
                  </TableCell>
                  <TableCell>{getTaskStatusLabel(task.status)}</TableCell>
                  <TableCell align="right">{formatMoney(task.plannedBudget)}</TableCell>
                  <TableCell align="right">{formatMoney(task.actualCost)}</TableCell>
                  <TableCell align="right">{formatMoney(task.variance)}</TableCell>
                  <TableCell align="right">{formatPercentage(task.consumedPercentage)}</TableCell>
                  {canManage ? (
                    <TableCell align="right">
                      <Tooltip title="Editar presupuesto y costo">
                        <IconButton
                          aria-label={`Editar presupuesto y costo de ${task.name}`}
                          onClick={() => {
                            setTaskToEdit(task);
                            setTaskValues({
                              plannedBudget: task.plannedBudget,
                              actualCost: task.actualCost,
                            });
                            setSubmitError(null);
                            setFormErrors({});
                          }}
                        >
                          <EditOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={budgetDialogOpen}
        onClose={
          isSubmitting
            ? undefined
            : () => {
                setBudgetDialogOpen(false);
              }
        }
        fullWidth
      >
        <DialogTitle>Editar presupuesto aprobado</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            id="project-budget-form"
            spacing={2.5}
            onSubmit={(event) => {
              void handleBudgetSubmit(event);
            }}
            sx={{ pt: 1 }}
          >
            {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}
            <TextField
              label="Presupuesto aprobado"
              type="number"
              value={budgetValue}
              onChange={(event) => {
                setBudgetValue(event.target.value);
              }}
              error={formErrors.approvedBudget !== undefined}
              helperText={formErrors.approvedBudget ?? 'Monto no negativo con maximo 2 decimales.'}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBudgetDialogOpen(false);
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="project-budget-form"
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={isSubmitting}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={taskToEdit !== null}
        onClose={
          isSubmitting
            ? undefined
            : () => {
                setTaskToEdit(null);
              }
        }
        fullWidth
      >
        <DialogTitle>Editar valores financieros</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            id="task-financials-form"
            spacing={2.5}
            onSubmit={(event) => {
              void handleTaskSubmit(event);
            }}
            sx={{ pt: 1 }}
          >
            {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}
            <TextField
              label="Presupuesto planificado"
              type="number"
              value={taskValues.plannedBudget}
              onChange={(event) => {
                setTaskValues((currentValues) => ({
                  ...currentValues,
                  plannedBudget: event.target.value,
                }));
              }}
              error={formErrors.plannedBudget !== undefined}
              helperText={formErrors.plannedBudget ?? 'Monto no negativo con maximo 2 decimales.'}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              required
            />
            <TextField
              label="Costo ejecutado"
              type="number"
              value={taskValues.actualCost}
              onChange={(event) => {
                setTaskValues((currentValues) => ({
                  ...currentValues,
                  actualCost: event.target.value,
                }));
              }}
              error={formErrors.actualCost !== undefined}
              helperText={formErrors.actualCost ?? 'Monto no negativo con maximo 2 decimales.'}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTaskToEdit(null);
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="task-financials-form"
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={isSubmitting}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
