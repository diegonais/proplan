import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { useAuth } from '../../auth/authContext';
import { ProjectForm } from '../components/ProjectForm';
import { getProject, listActiveProjectManagers, updateProject } from '../services/projectsApi';
import { ManagerOption, Project, ProjectPayload } from '../types';

export function ProjectEditPage() {
  const { uuid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const [project, setProject] = useState<Project | null>(null);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [managerOptionsLoading, setManagerOptionsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const canEdit = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

  useEffect(() => {
    if (uuid === undefined) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setSubmitError(null);

    void getProject(uuid)
      .then((response) => {
        if (isActive) {
          setProject(response);
        }
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setSubmitError(getApiErrorMessage(requestError).message);
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

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    setManagerOptionsLoading(true);
    void listActiveProjectManagers()
      .then(setManagerOptions)
      .catch((requestError: unknown) => {
        setSubmitError(getApiErrorMessage(requestError).message);
      })
      .finally(() => {
        setManagerOptionsLoading(false);
      });
  }, [isAdmin]);

  if (!canEdit) {
    return <Navigate to="/unauthorized" replace />;
  }

  const handleSubmit = async (payload: ProjectPayload) => {
    if (project === null) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const updatedProject = await updateProject(project.uuid, payload);
      showNotification('Proyecto actualizado correctamente.', 'success');
      void navigate(`/projects/${updatedProject.uuid}`);
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress aria-label="Cargando proyecto para editar" />
        <Typography color="text.secondary">Cargando proyecto</Typography>
      </Stack>
    );
  }

  if (project === null) {
    return (
      <Stack spacing={2}>
        <Typography component="h1" variant="h1">
          Editar proyecto
        </Typography>
        <Alert severity="error">{submitError ?? 'No se encontro el proyecto solicitado.'}</Alert>
        <Button component={Link} to="/projects" startIcon={<ArrowBackOutlinedIcon />}>
          Volver a proyectos
        </Button>
      </Stack>
    );
  }

  if (project.status === 'COMPLETED') {
    return (
      <Stack spacing={2}>
        <Typography component="h1" variant="h1">
          Editar proyecto
        </Typography>
        <Alert severity="info">No se puede modificar un proyecto finalizado.</Alert>
        <Button component={Link} to={`/projects/${project.uuid}`} startIcon={<ArrowBackOutlinedIcon />}>
          Volver al proyecto
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Stack spacing={0.5}>
          <Typography component="h1" variant="h1">
            Editar proyecto
          </Typography>
          <Typography color="text.secondary">Actualice los datos generales autorizados.</Typography>
        </Stack>
        <Button component={Link} to={`/projects/${project.uuid}`} startIcon={<ArrowBackOutlinedIcon />}>
          Volver
        </Button>
      </Stack>

      <ProjectForm
        mode="edit"
        project={project}
        isAdmin={isAdmin}
        managerOptions={managerOptions}
        managerOptionsLoading={managerOptionsLoading}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onSubmit={handleSubmit}
      />
    </Stack>
  );
}
