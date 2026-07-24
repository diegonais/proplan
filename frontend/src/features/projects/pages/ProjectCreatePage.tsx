import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { useAuth } from '../../auth/authContext';
import { ProjectForm } from '../components/ProjectForm';
import { createProject, listActiveProjectManagers } from '../services/projectsApi';
import { ManagerOption, ProjectPayload } from '../types';

export function ProjectCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [managerOptionsLoading, setManagerOptionsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const canCreate = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

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

  if (!canCreate) {
    return <Navigate to="/unauthorized" replace />;
  }

  const handleSubmit = async (payload: ProjectPayload) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const project = await createProject(payload);
      showNotification('Proyecto creado correctamente.', 'success');
      void navigate(`/projects/${project.uuid}`);
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Stack spacing={0.5}>
          <Typography component="h1" variant="h1">
            Crear proyecto
          </Typography>
          <Typography color="text.secondary">
            Registre los datos generales y el jefe responsable del proyecto.
          </Typography>
        </Stack>
        <Button component={Link} to="/projects" startIcon={<ArrowBackOutlinedIcon />}>
          Volver
        </Button>
      </Stack>

      {isAdmin && managerOptionsLoading ? (
        <Alert severity="info" icon={<CircularProgress size={20} />}>
          Cargando jefes de proyecto disponibles.
        </Alert>
      ) : null}

      <ProjectForm
        mode="create"
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
