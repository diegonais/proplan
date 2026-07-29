import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getApiErrorMessage } from '../../../services/http/apiError';
import { useAuth } from '../../auth/authContext';
import { getProject, listProjects } from '../../projects/services/projectsApi';
import { Project } from '../../projects/types';
import { ProjectGanttTab } from '../components/ProjectGanttTab';
import { ProjectReportsTab } from '../components/ProjectReportsTab';

const reportsProjectLimit = 100;

export function ReportsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryProjectUuid = searchParams.get('projectUuid') ?? '';
  const [projectOptions, setProjectOptions] = useState<Project[]>([]);
  const [selectedProjectUuid, setSelectedProjectUuid] = useState(queryProjectUuid);
  const [selectedReportTab, setSelectedReportTab] = useState(0);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);

  useEffect(() => {
    setSelectedProjectUuid(queryProjectUuid);
  }, [queryProjectUuid]);

  useEffect(() => {
    if (user === null) {
      return;
    }

    let isActive = true;
    setIsLoadingProjects(true);
    setError(null);
    setSelectionWarning(null);

    async function loadProjects() {
      if (user === null) {
        return;
      }

      const response = await listProjects({
        page: 1,
        limit: reportsProjectLimit,
        orderBy: 'name',
        order: 'ASC',
      });
      const authorizedProjects = response.data.filter((project) =>
        canSelectProjectForReports(project, user.uuid, user.role),
      );

      if (
        queryProjectUuid.length === 0 ||
        authorizedProjects.some((project) => project.uuid === queryProjectUuid)
      ) {
        return authorizedProjects;
      }

      try {
        const queryProject = await getProject(queryProjectUuid);

        if (!canSelectProjectForReports(queryProject, user.uuid, user.role)) {
          setSelectionWarning('El proyecto indicado no esta disponible para reportes con su rol.');
          return authorizedProjects;
        }

        return [queryProject, ...authorizedProjects];
      } catch (requestError: unknown) {
        setSelectionWarning(getApiErrorMessage(requestError).message);
        return authorizedProjects;
      }
    }

    void loadProjects()
      .then((projects) => {
        if (isActive && projects !== undefined) {
          setProjectOptions(dedupeProjects(projects));
        }
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setError(getApiErrorMessage(requestError).message);
          setProjectOptions([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingProjects(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [queryProjectUuid, user]);

  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.uuid === selectedProjectUuid) ?? null,
    [projectOptions, selectedProjectUuid],
  );

  const canViewFinancialDetails =
    selectedProject !== null &&
    user !== null &&
    (user.role === 'ADMIN' ||
      (user.role === 'PROJECT_MANAGER' && selectedProject.managerUuid === user.uuid));

  const selectProject = (projectUuid: string) => {
    setSelectedProjectUuid(projectUuid);
    setSelectedReportTab(0);

    if (projectUuid.length === 0) {
      setSearchParams({});
      return;
    }

    setSearchParams({ projectUuid });
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h1">
          Reportes
        </Typography>
        <Typography color="text.secondary">
          Analisis por proyecto autorizado: Gantt, carga, presupuesto, estado y exportaciones.
        </Typography>
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        {isLoadingProjects ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 3 }}>
            <CircularProgress aria-label="Cargando proyectos para reportes" />
            <Typography color="text.secondary">Cargando proyectos disponibles</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {error !== null ? <Alert severity="error">{error}</Alert> : null}
            {selectionWarning !== null ? <Alert severity="warning">{selectionWarning}</Alert> : null}
            <TextField
              label="Proyecto"
              select
              fullWidth
              value={selectedProject?.uuid ?? ''}
              onChange={(event) => {
                selectProject(event.target.value);
              }}
              helperText="Solo se muestran proyectos disponibles para su rol."
            >
              <MenuItem value="">Seleccione un proyecto</MenuItem>
              {projectOptions.map((project) => (
                <MenuItem key={project.uuid} value={project.uuid}>
                  {project.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        )}
      </Paper>

      {!isLoadingProjects && selectedProject === null ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}>
          <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center' }}>
            <AssessmentOutlinedIcon color="primary" aria-hidden="true" />
            <Typography component="h2" variant="h5">
              Seleccione un proyecto
            </Typography>
            <Typography color="text.secondary">
              Los reportes se cargaran cuando elija un proyecto del selector.
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {selectedProject !== null ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <Tabs
            value={selectedReportTab}
            onChange={(_event, nextValue: number) => {
              setSelectedReportTab(nextValue);
            }}
            aria-label="Reportes del proyecto seleccionado"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Diagrama de Gantt" />
            <Tab label="Indicadores y exportaciones" />
          </Tabs>
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {selectedReportTab === 0 ? <ProjectGanttTab project={selectedProject} /> : null}
            {selectedReportTab === 1 ? (
              <ProjectReportsTab
                project={selectedProject}
                canViewFinancialDetails={canViewFinancialDetails}
              />
            ) : null}
          </Box>
        </Paper>
      ) : null}
    </Stack>
  );
}

function canSelectProjectForReports(
  project: Project,
  userUuid: string,
  role: 'ADMIN' | 'PROJECT_MANAGER' | 'USER',
): boolean {
  if (role === 'ADMIN') {
    return true;
  }

  if (role === 'PROJECT_MANAGER') {
    return project.managerUuid === userUuid;
  }

  return true;
}

function dedupeProjects(projects: Project[]): Project[] {
  const projectsByUuid = new Map(projects.map((project) => [project.uuid, project]));

  return Array.from(projectsByUuid.values());
}
