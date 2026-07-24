import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { useAuth } from '../../auth/authContext';
import { DeleteProjectDialog } from '../components/DeleteProjectDialog';
import { ProjectStatusChip } from '../components/ProjectStatusChip';
import {
  deleteProject,
  listActiveProjectManagers,
  listProjects,
} from '../services/projectsApi';
import {
  ManagerOption,
  PaginatedProjectsResponse,
  Project,
  ProjectStatus,
  getProjectStatusLabel,
  projectStatuses,
} from '../types';

const defaultResponse: PaginatedProjectsResponse = {
  data: [],
  meta: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
};

export function ProjectsListPage() {
  const { user } = useAuth();
  const { showNotification } = useNotifications();
  const [projectsResponse, setProjectsResponse] = useState<PaginatedProjectsResponse>(defaultResponse);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [managerUuid, setManagerUuid] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const canCreateProjects = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
  const canManageProjects = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    void listActiveProjectManagers()
      .then(setManagerOptions)
      .catch(() => {
        showNotification('No se pudo cargar la lista de jefes de proyecto.', 'warning');
      });
  }, [isAdmin, showNotification]);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError(null);

    void listProjects({
      page: page + 1,
      limit,
      search,
      status: status || undefined,
      managerUuid: isAdmin ? managerUuid : undefined,
      orderBy: 'createdAt',
      order: 'DESC',
    })
      .then((response) => {
        if (isActive) {
          setProjectsResponse(response);
        }
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setError(getApiErrorMessage(requestError).message);
          setProjectsResponse(defaultResponse);
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
  }, [isAdmin, limit, managerUuid, page, search, status]);

  const hasFilters = search.trim().length > 0 || status.length > 0 || managerUuid.length > 0;
  const emptyMessage = hasFilters
    ? 'No se encontraron proyectos con los filtros seleccionados.'
    : 'Todavia no hay proyectos registrados para su rol.';

  const selectedProjectName = useMemo(
    () => projectToDelete?.name ?? 'seleccionado',
    [projectToDelete],
  );

  const handleDeleteProject = async () => {
    if (projectToDelete === null) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.uuid);
      showNotification('Proyecto eliminado logicamente.', 'success');
      setProjectToDelete(null);
      const response = await listProjects({
        page: page + 1,
        limit,
        search,
        status: status || undefined,
        managerUuid: isAdmin ? managerUuid : undefined,
        orderBy: 'createdAt',
        order: 'DESC',
      });
      setProjectsResponse(response);
    } catch (requestError) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h1" variant="h1">
            Proyectos
          </Typography>
          <Typography color="text.secondary">
            Gestion de datos generales, responsables, fechas y estado del proyecto.
          </Typography>
        </Box>
        {canCreateProjects ? (
          <Button component={Link} to="/projects/new" variant="contained" startIcon={<AddOutlinedIcon />}>
            Nuevo proyecto
          </Button>
        ) : null}
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Buscar por nombre"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
          <TextField
            label="Estado"
            select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ProjectStatus | '');
              setPage(0);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {projectStatuses.map((projectStatus) => (
              <MenuItem key={projectStatus} value={projectStatus}>
                {getProjectStatusLabel(projectStatus)}
              </MenuItem>
            ))}
          </TextField>
          {isAdmin ? (
            <TextField
              label="Jefe de proyecto"
              select
              value={managerUuid}
              onChange={(event) => {
                setManagerUuid(event.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              {managerOptions.map((manager) => (
                <MenuItem key={manager.uuid} value={manager.uuid}>
                  {manager.name}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
      </Paper>

      {error !== null ? <Alert severity="error">{error}</Alert> : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        {isLoading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress aria-label="Cargando proyectos" />
            <Typography color="text.secondary">Cargando proyectos</Typography>
          </Stack>
        ) : (
          <Table aria-label="Listado de proyectos">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Jefe</TableCell>
                <TableCell>Fechas</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Presupuesto</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectsResponse.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <Typography color="text.secondary">{emptyMessage}</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                projectsResponse.data.map((project) => (
                  <TableRow key={project.uuid} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{project.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {project.objective}
                      </Typography>
                    </TableCell>
                    <TableCell>{project.manager.name}</TableCell>
                    <TableCell>
                      {project.startDate} a {project.endDate}
                    </TableCell>
                    <TableCell>
                      <ProjectStatusChip status={project.status} />
                    </TableCell>
                    <TableCell align="right">{formatMoney(project.approvedBudget)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver detalle">
                        <IconButton component={Link} to={`/projects/${project.uuid}`} aria-label="Ver detalle">
                          <VisibilityOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                      {canManageProjects ? (
                        <>
                          <Tooltip title="Editar">
                            <IconButton component={Link} to={`/projects/${project.uuid}/edit`} aria-label="Editar">
                              <EditOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              color="error"
                              aria-label="Eliminar"
                              onClick={() => {
                                setProjectToDelete(project);
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
        <TablePagination
          component="div"
          count={projectsResponse.meta.total}
          page={page}
          rowsPerPage={limit}
          rowsPerPageOptions={[5, 10, 25]}
          labelRowsPerPage="Filas por pagina"
          labelDisplayedRows={({ from, to, count }) =>
            `${String(from)}-${String(to)} de ${String(count)}`
          }
          onPageChange={(_event, nextPage) => {
            setPage(nextPage);
          }}
          onRowsPerPageChange={(event) => {
            setLimit(Number(event.target.value));
            setPage(0);
          }}
        />
      </TableContainer>

      <DeleteProjectDialog
        open={projectToDelete !== null}
        projectName={selectedProjectName}
        isDeleting={isDeleting}
        onCancel={() => {
          setProjectToDelete(null);
        }}
        onConfirm={() => {
          void handleDeleteProject();
        }}
      />
    </Stack>
  );
}

function formatMoney(value: string): string {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
  }).format(Number(value));
}
