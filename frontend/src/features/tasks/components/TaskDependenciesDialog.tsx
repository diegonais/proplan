import AddLinkOutlinedIcon from '@mui/icons-material/AddLinkOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
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
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '../../../services/http/apiError';
import {
  createTaskDependency,
  deleteTaskDependency,
  listTaskDependencies,
} from '../services/tasksApi';
import {
  Task,
  TaskDependenciesResponse,
  TaskDependency,
  getTaskDependencyTypeLabel,
} from '../types';

interface TaskDependenciesDialogProps {
  open: boolean;
  task: Task | null;
  tasks: readonly Task[];
  canManage: boolean;
  onClose: () => void;
}

const emptyDependencies: TaskDependenciesResponse = {
  incoming: [],
  outgoing: [],
};

export function TaskDependenciesDialog({
  open,
  task,
  tasks,
  canManage,
  onClose,
}: TaskDependenciesDialogProps) {
  const [dependencies, setDependencies] = useState<TaskDependenciesResponse>(emptyDependencies);
  const [predecessorTaskUuid, setPredecessorTaskUuid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || task === null) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);
    setPredecessorTaskUuid('');

    void listTaskDependencies(task.uuid)
      .then((response) => {
        if (isActive) {
          setDependencies(response);
        }
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setError(getApiErrorMessage(requestError).message);
          setDependencies(emptyDependencies);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [open, task]);

  const predecessorOptions = useMemo(() => {
    if (task === null) {
      return [];
    }

    const currentPredecessorUuids = new Set(
      dependencies.incoming.map((dependency) => dependency.predecessorTaskUuid),
    );

    return tasks.filter(
      (candidate) => candidate.uuid !== task.uuid && !currentPredecessorUuids.has(candidate.uuid),
    );
  }, [dependencies.incoming, task, tasks]);

  const handleCreateDependency = async () => {
    if (task === null || predecessorTaskUuid.length === 0) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createTaskDependency(task.uuid, predecessorTaskUuid);
      const response = await listTaskDependencies(task.uuid);
      setDependencies(response);
      setPredecessorTaskUuid('');
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDependency = async (dependencyUuid: string) => {
    if (task === null) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await deleteTaskDependency(dependencyUuid);
      const response = await listTaskDependencies(task.uuid);
      setDependencies(response);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={isSaving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Dependencias de actividad</DialogTitle>
      <DialogContent>
        {task === null ? null : (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>{task.name}</Typography>

            {error !== null ? <Alert severity="error">{error}</Alert> : null}

            {canManage ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Predecesora"
                  select
                  value={predecessorTaskUuid}
                  onChange={(event) => {
                    setPredecessorTaskUuid(event.target.value);
                  }}
                  helperText="Solo se registra dependencia fin a inicio."
                  disabled={isLoading || isSaving}
                  fullWidth
                >
                  {predecessorOptions.map((predecessorOption) => (
                    <MenuItem key={predecessorOption.uuid} value={predecessorOption.uuid}>
                      {predecessorOption.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  startIcon={<AddLinkOutlinedIcon />}
                  disabled={predecessorTaskUuid.length === 0 || isSaving}
                  onClick={() => {
                    void handleCreateDependency();
                  }}
                >
                  Agregar
                </Button>
              </Stack>
            ) : null}

            {isLoading ? (
              <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
                <CircularProgress aria-label="Cargando dependencias" />
                <Typography color="text.secondary">Cargando dependencias</Typography>
              </Stack>
            ) : (
              <Stack spacing={3}>
                <DependenciesTable
                  title="Predecesoras"
                  emptyMessage="Esta actividad no tiene predecesoras."
                  dependencies={dependencies.incoming}
                  direction="incoming"
                  canManage={canManage}
                  isSaving={isSaving}
                  onDelete={(dependencyUuid) => {
                    void handleDeleteDependency(dependencyUuid);
                  }}
                />
                <DependenciesTable
                  title="Sucesoras"
                  emptyMessage="Esta actividad no tiene sucesoras."
                  dependencies={dependencies.outgoing}
                  direction="outgoing"
                  canManage={canManage}
                  isSaving={isSaving}
                  onDelete={(dependencyUuid) => {
                    void handleDeleteDependency(dependencyUuid);
                  }}
                />
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface DependenciesTableProps {
  title: string;
  emptyMessage: string;
  dependencies: readonly TaskDependency[];
  direction: 'incoming' | 'outgoing';
  canManage: boolean;
  isSaving: boolean;
  onDelete: (dependencyUuid: string) => void;
}

function DependenciesTable({
  title,
  emptyMessage,
  dependencies,
  direction,
  canManage,
  isSaving,
  onDelete,
}: DependenciesTableProps) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
        {title}
      </Typography>
      <Table size="small" aria-label={title}>
        <TableHead>
          <TableRow>
            <TableCell>Actividad</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Fechas</TableCell>
            {canManage ? <TableCell align="right">Acciones</TableCell> : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {dependencies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 4 : 3}>
                <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  {emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            dependencies.map((dependency) => {
              const relatedTask =
                direction === 'incoming' ? dependency.predecessorTask : dependency.successorTask;

              return (
                <TableRow key={dependency.uuid}>
                  <TableCell>{relatedTask.name}</TableCell>
                  <TableCell>{getTaskDependencyTypeLabel(dependency.dependencyType)}</TableCell>
                  <TableCell>
                    {relatedTask.startDate} a {relatedTask.endDate}
                  </TableCell>
                  {canManage ? (
                    <TableCell align="right">
                      <Tooltip title="Eliminar dependencia">
                        <span>
                          <IconButton
                            color="error"
                            aria-label="Eliminar dependencia"
                            disabled={isSaving}
                            onClick={() => {
                              onDelete(dependency.uuid);
                            }}
                          >
                            <DeleteOutlineOutlinedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
