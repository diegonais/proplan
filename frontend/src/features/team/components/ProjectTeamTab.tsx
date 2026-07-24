import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
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
import { Project } from '../../projects/types';
import {
  addProjectMember,
  getProjectWorkload,
  listProjectMemberCandidates,
  listProjectMembers,
  removeProjectMember,
} from '../services/teamApi';
import { ProjectMember, ProjectMemberCandidate, WorkloadItem } from '../types';

interface ProjectTeamTabProps {
  project: Project;
  canManage: boolean;
}

export function ProjectTeamTab({ project, canManage }: ProjectTeamTabProps) {
  const { showNotification } = useNotifications();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [candidates, setCandidates] = useState<ProjectMemberCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserUuid, setSelectedUserUuid] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [membersResponse, workloadResponse] = await Promise.all([
        listProjectMembers(project.uuid),
        getProjectWorkload(project.uuid),
      ]);
      setMembers(membersResponse);
      setWorkload(workloadResponse);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setMembers([]);
      setWorkload([]);
    } finally {
      setIsLoading(false);
    }
  }, [project.uuid]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const workloadByUser = useMemo(
    () => new Map(workload.map((item) => [item.userUuid, item.assignedHours])),
    [workload],
  );

  const openAddDialog = async () => {
    setSubmitError(null);
    setSelectedUserUuid('');
    setIsAddDialogOpen(true);
    try {
      const response = await listProjectMemberCandidates(project.uuid);
      setCandidates(response);
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
      setCandidates([]);
    }
  };

  const handleAddMember = async () => {
    if (selectedUserUuid.length === 0) {
      setSubmitError('Seleccione un usuario activo.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await addProjectMember(project.uuid, selectedUserUuid);
      showNotification('Miembro agregado correctamente.', 'success');
      setIsAddDialogOpen(false);
      await loadTeam();
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (memberToRemove === null) {
      return;
    }

    setIsSubmitting(true);
    try {
      await removeProjectMember(project.uuid, memberToRemove.userUuid);
      showNotification('Miembro retirado correctamente.', 'success');
      setMemberToRemove(null);
      await loadTeam();
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="h5">
            Equipo
          </Typography>
          <Typography color="text.secondary">
            Miembros del proyecto y carga calculada por horas asignadas.
          </Typography>
        </Box>
        {canManage ? (
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => {
              void openAddDialog();
            }}
          >
            Agregar miembro
          </Button>
        ) : null}
      </Stack>

      {error !== null ? <Alert severity="error">{error}</Alert> : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        {isLoading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress aria-label="Cargando equipo" />
            <Typography color="text.secondary">Cargando equipo</Typography>
          </Stack>
        ) : (
          <Table aria-label="Miembros del proyecto">
            <TableHead>
              <TableRow>
                <TableCell>Miembro</TableCell>
                <TableCell>Rol general</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Horas asignadas</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <Typography color="text.secondary">No hay miembros registrados.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const isManager = member.userUuid === project.managerUuid;

                  return (
                    <TableRow key={member.uuid} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography sx={{ fontWeight: 700 }}>{member.user.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {member.user.email}
                          </Typography>
                          {isManager ? <Typography variant="body2">Jefe del proyecto</Typography> : null}
                        </Stack>
                      </TableCell>
                      <TableCell>{getRoleLabel(member.user.role)}</TableCell>
                      <TableCell>
                        <Chip
                          label={member.user.isActive ? 'Activo' : 'Inactivo'}
                          color={member.user.isActive ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatHours(workloadByUser.get(member.userUuid) ?? member.assignedHours)}
                      </TableCell>
                      <TableCell align="right">
                        {canManage ? (
                          <Tooltip
                            title={
                              isManager
                                ? 'El jefe del proyecto debe permanecer como miembro'
                                : 'Retirar miembro'
                            }
                          >
                            <span>
                              <Button
                                color="error"
                                variant="outlined"
                                size="small"
                                startIcon={<DeleteOutlineOutlinedIcon />}
                                disabled={isManager}
                                onClick={() => {
                                  setMemberToRemove(member);
                                }}
                              >
                                Retirar
                              </Button>
                            </span>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Table aria-label="Carga de trabajo por recurso">
          <TableHead>
            <TableRow>
              <TableCell>Recurso</TableCell>
              <TableCell>Rol general</TableCell>
              <TableCell align="right">Horas asignadas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workload.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      Todavia no hay horas asignadas a los recursos del proyecto.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              workload.map((item) => (
                <TableRow key={item.userUuid} hover>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography sx={{ fontWeight: 700 }}>{item.user.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.user.email}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{getRoleLabel(item.user.role)}</TableCell>
                  <TableCell align="right">{formatHours(item.assignedHours)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={isAddDialogOpen}
        onClose={
          isSubmitting
            ? undefined
            : () => {
                setIsAddDialogOpen(false);
              }
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Agregar miembro</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {submitError !== null ? <Alert severity="error">{submitError}</Alert> : null}
            <TextField
              label="Usuario activo"
              select
              value={selectedUserUuid}
              onChange={(event) => {
                setSelectedUserUuid(event.target.value);
              }}
              helperText="Solo se muestran usuarios activos que aun no pertenecen al proyecto."
              required
            >
              {candidates.map((candidate) => (
                <MenuItem key={candidate.uuid} value={candidate.uuid}>
                  {candidate.name} - {candidate.email} - {getRoleLabel(candidate.role)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsAddDialogOpen(false);
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleAddMember()} disabled={isSubmitting}>
            Agregar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={memberToRemove !== null}
        onClose={
          isSubmitting
            ? undefined
            : () => {
                setMemberToRemove(null);
              }
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Retirar miembro</DialogTitle>
        <DialogContent>
          <Typography>
            Se verificaran asignaciones activas antes de retirar a{' '}
            <strong>{memberToRemove?.user.name ?? 'este miembro'}</strong>. Las asignaciones no se
            eliminaran automaticamente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMemberToRemove(null);
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleRemoveMember()}
            disabled={isSubmitting}
          >
            Retirar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function formatHours(value: string): string {
  return `${new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 2,
  }).format(Number(value))} h`;
}
