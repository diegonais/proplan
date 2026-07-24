import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined';
import {
  Alert,
  Button,
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

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { getRoleLabel } from '../../auth/types';
import { listProjectMembers } from '../../team/services/teamApi';
import { ProjectMember } from '../../team/types';
import {
  createTaskAssignment,
  deleteTaskAssignment,
  listTaskAssignments,
  setTaskMainResponsible,
  updateTaskAssignment,
} from '../services/tasksApi';
import { Task, TaskAssignment } from '../types';

interface TaskAssignmentsDialogProps {
  open: boolean;
  task: Task | null;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function TaskAssignmentsDialog({
  open,
  task,
  canManage,
  onClose,
  onChanged,
}: TaskAssignmentsDialogProps) {
  const { showNotification } = useNotifications();
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedUserUuid, setSelectedUserUuid] = useState('');
  const [assignedHours, setAssignedHours] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (task === null) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [assignmentsResponse, membersResponse] = await Promise.all([
        listTaskAssignments(task.uuid),
        listProjectMembers(task.projectUuid),
      ]);
      setAssignments(assignmentsResponse);
      setMembers(membersResponse);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setAssignments([]);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [task]);

  useEffect(() => {
    if (open) {
      setSelectedUserUuid('');
      setAssignedHours('0');
      void loadAssignments();
    }
  }, [loadAssignments, open]);

  const assignedUserUuids = useMemo(
    () => new Set(assignments.map((assignment) => assignment.userUuid)),
    [assignments],
  );
  const availableMembers = members.filter(
    (member) => member.user.isActive && !assignedUserUuids.has(member.userUuid),
  );

  const handleAddAssignment = async () => {
    if (task === null) {
      return;
    }

    if (selectedUserUuid.length === 0) {
      setError('Seleccione un miembro activo del proyecto.');
      return;
    }

    if (assignedHours.length === 0 || Number.isNaN(Number(assignedHours)) || Number(assignedHours) < 0) {
      setError('Las horas asignadas deben ser mayores o iguales a cero.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createTaskAssignment(task.uuid, {
        userUuid: selectedUserUuid,
        assignedHours: Number(assignedHours),
      });
      showNotification('Asignacion creada correctamente.', 'success');
      setSelectedUserUuid('');
      setAssignedHours('0');
      await loadAssignments();
      await onChanged();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateHours = async (assignment: TaskAssignment, nextHours: string) => {
    if (nextHours.length === 0 || Number.isNaN(Number(nextHours)) || Number(nextHours) < 0) {
      setError('Las horas asignadas deben ser mayores o iguales a cero.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await updateTaskAssignment(assignment.uuid, Number(nextHours));
      showNotification('Horas actualizadas correctamente.', 'success');
      await loadAssignments();
      await onChanged();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetMainResponsible = async (assignment: TaskAssignment) => {
    if (task === null) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await setTaskMainResponsible(task.uuid, assignment.userUuid);
      showNotification('Responsable principal actualizado correctamente.', 'success');
      await loadAssignments();
      await onChanged();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignment: TaskAssignment) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteTaskAssignment(assignment.uuid);
      showNotification('Asignacion eliminada correctamente.', 'success');
      await loadAssignments();
      await onChanged();
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Asignaciones de actividad</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography color="text.secondary">
            {task?.name ?? 'Actividad seleccionada'}
          </Typography>

          {error !== null ? <Alert severity="error">{error}</Alert> : null}

          {canManage ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Miembro asignado"
                select
                value={selectedUserUuid}
                onChange={(event) => {
                  setSelectedUserUuid(event.target.value);
                }}
                helperText="Solo miembros activos sin asignacion previa."
                sx={{ flex: 1 }}
              >
                {availableMembers.map((member) => (
                  <MenuItem key={member.userUuid} value={member.userUuid}>
                    {member.user.name} - {getRoleLabel(member.user.role)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Horas asignadas"
                type="number"
                value={assignedHours}
                onChange={(event) => {
                  setAssignedHours(event.target.value);
                }}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                sx={{ width: { xs: '100%', sm: 180 } }}
              />
              <Button
                variant="contained"
                startIcon={<AddOutlinedIcon />}
                onClick={() => void handleAddAssignment()}
                disabled={isSubmitting}
              >
                Asignar
              </Button>
            </Stack>
          ) : null}

          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Table aria-label="Usuarios asignados a la actividad">
              <TableHead>
                <TableRow>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Rol general</TableCell>
                  <TableCell>Responsable principal</TableCell>
                  <TableCell align="right">Horas asignadas</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        No hay usuarios asignados a esta actividad.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((assignment) => (
                    <TableRow key={assignment.uuid} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography sx={{ fontWeight: 700 }}>{assignment.user.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {assignment.user.email}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{getRoleLabel(assignment.user.role)}</TableCell>
                      <TableCell>{assignment.isMainResponsible ? 'Si' : 'No'}</TableCell>
                      <TableCell align="right">
                        {canManage ? (
                          <TextField
                            aria-label={`Horas asignadas a ${assignment.user.name}`}
                            type="number"
                            size="small"
                            defaultValue={assignment.assignedHours}
                            slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                            onBlur={(event) => {
                              if (event.target.value !== assignment.assignedHours) {
                                void handleUpdateHours(assignment, event.target.value);
                              }
                            }}
                            sx={{ maxWidth: 120 }}
                          />
                        ) : (
                          formatHours(assignment.assignedHours)
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {canManage ? (
                          <>
                            <Tooltip title="Marcar como responsable principal">
                              <span>
                                <IconButton
                                  aria-label="Marcar como responsable principal"
                                  disabled={assignment.isMainResponsible || isSubmitting}
                                  onClick={() => void handleSetMainResponsible(assignment)}
                                >
                                  <StarOutlineOutlinedIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Eliminar asignacion">
                              <IconButton
                                color="error"
                                aria-label="Eliminar asignacion"
                                disabled={isSubmitting}
                                onClick={() => void handleDeleteAssignment(assignment)}
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
          </TableContainer>

          {isLoading ? <Typography color="text.secondary">Cargando asignaciones</Typography> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function formatHours(value: string): string {
  return `${new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 2,
  }).format(Number(value))} h`;
}
