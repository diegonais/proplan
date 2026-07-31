import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { formatMoney } from '../../../utils/money';
import { Project } from '../../projects/types';
import {
  createTask,
  deleteTask,
  listProjectTasks,
  updateTask,
  updateOwnTaskProgress,
} from '../services/tasksApi';
import { Task, TaskPayload, TaskProgressPayload } from '../types';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { OwnTaskProgressDialog } from './OwnTaskProgressDialog';
import { TaskAssignmentsDialog } from './TaskAssignmentsDialog';
import { TaskDependenciesDialog } from './TaskDependenciesDialog';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskStatusChip } from './TaskStatusChip';

interface ProjectTasksTabProps {
  project: Project;
  canManage: boolean;
  isPersonalActivityView: boolean;
}

interface FlattenedTask {
  task: Task;
  level: number;
}

export function ProjectTasksTab({ project, canManage, isPersonalActivityView }: ProjectTasksTabProps) {
  const { showNotification } = useNotifications();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formState, setFormState] = useState<{
    mode: 'create' | 'edit';
    taskKind: 'activity' | 'subactivity';
    task: Task | null;
    parentTaskUuid: string | null;
  } | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [dependenciesTask, setDependenciesTask] = useState<Task | null>(null);
  const [assignmentsTask, setAssignmentsTask] = useState<Task | null>(null);
  const [progressTask, setProgressTask] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listProjectTasks(project.uuid);
      setTasks(response);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [project.uuid]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const flattenedTasks = useMemo(() => flattenTasks(tasks), [tasks]);
  const hasTasks = tasks.length > 0;
  const hasParentTasks = tasks.some((task) => task.parentTaskUuid === null);
  const isProjectCompleted = project.status === 'COMPLETED';
  const canManageTasks = canManage && !isProjectCompleted;
  const canUpdateOwnProgress = !canManage && !isProjectCompleted;
  const showResponsibleColumn = !isPersonalActivityView;
  const tableColumnCount = showResponsibleColumn ? 9 : 8;

  const handleSubmitTask = async (payload: TaskPayload) => {
    if (formState === null) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (formState.mode === 'create') {
        await createTask(project.uuid, payload);
        showNotification(
          formState.taskKind === 'activity'
            ? 'Actividad creada correctamente.'
            : 'Subactividad creada correctamente.',
          'success',
        );
      } else if (formState.task !== null) {
        await updateTask(formState.task.uuid, payload);
        showNotification(
          formState.taskKind === 'activity'
            ? 'Actividad actualizada correctamente.'
            : 'Subactividad actualizada correctamente.',
          'success',
        );
      }

      setFormState(null);
      await loadTasks();
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (taskToDelete === null) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteTask(taskToDelete.uuid);
      showNotification('Actividad eliminada logicamente.', 'success');
      setTaskToDelete(null);
      await loadTasks();
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOwnProgress = async (payload: TaskProgressPayload) => {
    if (progressTask === null) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await updateOwnTaskProgress(progressTask.uuid, payload);
      showNotification('Avance actualizado correctamente.', 'success');
      setProgressTask(null);
      await loadTasks();
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="h5">
            {isPersonalActivityView ? 'Mis actividades' : 'Actividades'}
          </Typography>
          <Typography color="text.secondary">
            {isPersonalActivityView
              ? 'Actividades asignadas a tu usuario dentro de este proyecto.'
              : 'Planificacion padre-hijo, responsable principal y dependencias fin a inicio del proyecto.'}
          </Typography>
        </Box>
        {canManageTasks ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => {
                setSubmitError(null);
                setFormState({
                  mode: 'create',
                  taskKind: 'activity',
                  task: null,
                  parentTaskUuid: null,
                });
              }}
            >
              Crear actividad
            </Button>
            <Button
              variant="outlined"
              startIcon={<AccountTreeOutlinedIcon />}
              disabled={!hasParentTasks}
              onClick={() => {
                setSubmitError(null);
                setFormState({
                  mode: 'create',
                  taskKind: 'subactivity',
                  task: null,
                  parentTaskUuid: null,
                });
              }}
            >
              Crear subactividad
            </Button>
          </Stack>
        ) : null}
      </Stack>

      {error !== null ? <Alert severity="error">{error}</Alert> : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        {isLoading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress aria-label="Cargando actividades" />
            <Typography color="text.secondary">Cargando actividades</Typography>
          </Stack>
        ) : (
          <Table aria-label={isPersonalActivityView ? 'Mis actividades asignadas' : 'Actividades del proyecto'}>
            <TableHead>
              <TableRow>
                <TableCell>Actividad</TableCell>
                {showResponsibleColumn ? <TableCell>Responsable</TableCell> : null}
                <TableCell>Estado</TableCell>
                <TableCell>Progreso</TableCell>
                <TableCell>Fechas</TableCell>
                <TableCell align="right">Horas</TableCell>
                <TableCell align="right">Presupuesto</TableCell>
                <TableCell align="right">Costo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!hasTasks ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount}>
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <Typography color="text.secondary">
                        {isPersonalActivityView
                          ? 'No tienes actividades asignadas en este proyecto.'
                          : 'Todavia no hay actividades registradas para este proyecto.'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                flattenedTasks.map(({ task, level }) => (
                  <TableRow key={task.uuid} hover>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ pl: level * 3 }}
                      >
                        {level > 0 ? <AccountTreeOutlinedIcon color="action" fontSize="small" /> : null}
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>{task.name}</Typography>
                          {task.description !== null ? (
                            <Typography variant="body2" color="text.secondary">
                              {task.description}
                            </Typography>
                          ) : null}
                        </Box>
                      </Stack>
                    </TableCell>
                    {showResponsibleColumn ? (
                      <TableCell>
                        {task.mainResponsible === null ? (
                          <Typography color="text.secondary">Sin responsable principal</Typography>
                        ) : (
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>{task.mainResponsible.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {task.mainResponsible.email}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <TaskStatusChip status={task.status} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Stack spacing={0.5}>
                        <LinearProgress variant="determinate" value={task.progress} />
                        <Typography variant="body2" color="text.secondary">
                          {task.progress}%
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {task.startDate} a {task.endDate}
                    </TableCell>
                    <TableCell align="right">{formatNumber(task.estimatedHours)}</TableCell>
                    <TableCell align="right">{formatMoney(task.plannedBudget)}</TableCell>
                    <TableCell align="right">{formatMoney(task.actualCost)}</TableCell>
                    <TableCell align="right">
                      {canManageTasks ? (
                        <Tooltip title="Asignaciones">
                          <IconButton
                            aria-label="Asignaciones"
                            onClick={() => {
                              setAssignmentsTask(task);
                            }}
                          >
                            <GroupOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                      ) : canUpdateOwnProgress ? (
                        <Tooltip title="Actualizar avance">
                          <IconButton
                            aria-label="Actualizar avance"
                            onClick={() => {
                              setSubmitError(null);
                              setProgressTask(task);
                            }}
                          >
                            <EditOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      <Tooltip title="Dependencias">
                        <IconButton
                          aria-label="Dependencias"
                          onClick={() => {
                            setDependenciesTask(task);
                          }}
                        >
                          <LinkOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                      {canManageTasks ? (
                        <>
                          <Tooltip title="Editar">
                            <IconButton
                              aria-label="Editar actividad"
                              onClick={() => {
                                setSubmitError(null);
                                setFormState({
                                  mode: 'edit',
                                  taskKind: task.parentTaskUuid === null ? 'activity' : 'subactivity',
                                  task,
                                  parentTaskUuid: task.parentTaskUuid,
                                });
                              }}
                            >
                              <EditOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              color="error"
                              aria-label="Eliminar actividad"
                              onClick={() => {
                                setTaskToDelete(task);
                              }}
                            >
                              <DeleteOutlineOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <TaskFormDialog
        open={formState !== null}
        mode={formState?.mode ?? 'create'}
        taskKind={formState?.taskKind ?? 'activity'}
        projectDateRange={{ startDate: project.startDate, endDate: project.endDate }}
        tasks={tasks}
        task={formState?.task}
        parentTaskUuid={formState?.parentTaskUuid}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onCancel={() => {
          setFormState(null);
          setSubmitError(null);
        }}
        onSubmit={handleSubmitTask}
      />

      <DeleteTaskDialog
        open={taskToDelete !== null}
        taskName={taskToDelete?.name ?? 'seleccionada'}
        isDeleting={isSubmitting}
        onCancel={() => {
          setTaskToDelete(null);
        }}
        onConfirm={() => {
          void handleDeleteTask();
        }}
      />

      <TaskDependenciesDialog
        open={dependenciesTask !== null}
        task={dependenciesTask}
        tasks={tasks}
        canManage={canManageTasks}
        onClose={() => {
          setDependenciesTask(null);
        }}
      />

      <TaskAssignmentsDialog
        open={assignmentsTask !== null}
        task={assignmentsTask}
        canManage={canManageTasks}
        onClose={() => {
          setAssignmentsTask(null);
        }}
        onChanged={loadTasks}
      />

      <OwnTaskProgressDialog
        open={progressTask !== null}
        task={progressTask}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onCancel={() => {
          setProgressTask(null);
          setSubmitError(null);
        }}
        onSubmit={handleSubmitOwnProgress}
      />
    </Stack>
  );
}

function flattenTasks(tasks: readonly Task[]): FlattenedTask[] {
  const childrenByParentUuid = new Map<string | null, Task[]>();

  tasks.forEach((task) => {
    const siblings = childrenByParentUuid.get(task.parentTaskUuid) ?? [];
    siblings.push(task);
    childrenByParentUuid.set(task.parentTaskUuid, siblings);
  });

  childrenByParentUuid.forEach((siblings) => {
    siblings.sort((firstTask, secondTask) => {
      const dateComparison = firstTask.startDate.localeCompare(secondTask.startDate);
      return dateComparison === 0 ? firstTask.name.localeCompare(secondTask.name) : dateComparison;
    });
  });

  const flattenedTasks: FlattenedTask[] = [];
  const visitedTaskUuids = new Set<string>();

  const visit = (parentTaskUuid: string | null, level: number) => {
    const children = childrenByParentUuid.get(parentTaskUuid) ?? [];

    children.forEach((task) => {
      if (visitedTaskUuids.has(task.uuid)) {
        return;
      }

      visitedTaskUuids.add(task.uuid);
      flattenedTasks.push({ task, level });
      visit(task.uuid, level + 1);
    });
  };

  visit(null, 0);

  tasks.forEach((task) => {
    if (!visitedTaskUuids.has(task.uuid)) {
      flattenedTasks.push({ task, level: 0 });
    }
  });

  return flattenedTasks;
}

function formatNumber(value: string): string {
  return new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 2,
  }).format(Number(value));
}
