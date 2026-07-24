import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { formatMoney } from '../../../utils/money';
import { useAuth } from '../../auth/authContext';
import { ProjectTeamTab } from '../../team/components/ProjectTeamTab';
import { ProjectTasksTab } from '../../tasks/components/ProjectTasksTab';
import { ProjectGanttTab } from '../../reports/components/ProjectGanttTab';
import { ProjectReportsTab } from '../../reports/components/ProjectReportsTab';
import { DeleteProjectDialog } from '../components/DeleteProjectDialog';
import { ProjectBudgetTab } from '../components/ProjectBudgetTab';
import { ProjectStatusChip } from '../components/ProjectStatusChip';
import { deleteProject, getProject } from '../services/projectsApi';
import { Project } from '../types';

export function ProjectDetailPage() {
  const { uuid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  const canManageProject =
    project !== null &&
    (user?.role === 'ADMIN' ||
      (user?.role === 'PROJECT_MANAGER' && project.managerUuid === user.uuid));

  useEffect(() => {
    if (uuid === undefined) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void getProject(uuid)
      .then((response) => {
        if (isActive) {
          setProject(response);
        }
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setError(getApiErrorMessage(requestError).message);
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
  }, [uuid]);

  const handleDelete = async () => {
    if (project === null) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(project.uuid);
      showNotification('Proyecto eliminado logicamente.', 'success');
      void navigate('/projects');
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress aria-label="Cargando detalle de proyecto" />
        <Typography color="text.secondary">Cargando detalle del proyecto</Typography>
      </Stack>
    );
  }

  if (error !== null || project === null) {
    return (
      <Stack spacing={2}>
        <Typography component="h1" variant="h1">
          Detalle de proyecto
        </Typography>
        <Alert severity="error">{error ?? 'No se encontro el proyecto solicitado.'}</Alert>
        <Button component={Link} to="/projects" startIcon={<ArrowBackOutlinedIcon />}>
          Volver a proyectos
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Stack spacing={0.5}>
          <Typography component="h1" variant="h1">
            {project.name}
          </Typography>
          <Typography color="text.secondary">{project.objective}</Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button component={Link} to="/projects" startIcon={<ArrowBackOutlinedIcon />}>
            Volver
          </Button>
          {canManageProject ? (
            <>
              <Button component={Link} to={`/projects/${project.uuid}/edit`} startIcon={<EditOutlinedIcon />}>
                Editar
              </Button>
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteOutlineOutlinedIcon />}
                onClick={() => {
                  setIsDeleteDialogOpen(true);
                }}
              >
                Eliminar
              </Button>
            </>
          ) : null}
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Tabs
          value={selectedTab}
          onChange={(_event, nextValue: number) => {
            setSelectedTab(nextValue);
          }}
          aria-label="Secciones del proyecto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Resumen" />
          <Tab label="Actividades" />
          <Tab label="Gantt" />
          <Tab label="Equipo" />
          {canManageProject ? <Tab label="Presupuesto" /> : null}
          <Tab label="Reportes" />
        </Tabs>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {selectedTab === 0 ? (
            <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Estado
                  </Typography>
                  <ProjectStatusChip status={project.status} />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Jefe de proyecto
                  </Typography>
                  <Typography>{project.manager.name}</Typography>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Presupuesto aprobado
                  </Typography>
                  <Typography>{formatMoney(project.approvedBudget)}</Typography>
                </Stack>
              </Stack>

              <Divider />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Fecha de inicio
                  </Typography>
                  <Typography>{project.startDate}</Typography>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Fecha de fin
                  </Typography>
                  <Typography>{project.endDate}</Typography>
                </Stack>
              </Stack>

              {project.description !== null ? (
                <>
                  <Divider />
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Descripcion
                    </Typography>
                    <Typography>{project.description}</Typography>
                  </Stack>
                </>
              ) : null}
            </Stack>
          ) : null}
          {selectedTab === 1 ? (
            <ProjectTasksTab project={project} canManage={canManageProject} />
          ) : null}
          {selectedTab === 2 ? (
            <ProjectGanttTab project={project} />
          ) : null}
          {selectedTab === 3 ? (
            <ProjectTeamTab project={project} canManage={canManageProject} />
          ) : null}
          {selectedTab === 4 && canManageProject ? (
            <ProjectBudgetTab
              project={project}
              canManage={canManageProject}
              onProjectUpdated={(updatedProject) => {
                setProject(updatedProject);
              }}
            />
          ) : null}
          {selectedTab === (canManageProject ? 5 : 4) ? (
            <ProjectReportsTab project={project} canViewFinancialDetails={canManageProject} />
          ) : null}
        </Box>
      </Paper>

      <DeleteProjectDialog
        open={isDeleteDialogOpen}
        projectName={project.name}
        isDeleting={isDeleting}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </Stack>
  );
}
