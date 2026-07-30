import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getApiErrorMessage } from '../../../services/http/apiError';
import { useAuth } from '../../auth/authContext';
import { getProject, listProjects } from '../../projects/services/projectsApi';
import { Project } from '../../projects/types';
import { ProjectGanttTab } from '../components/ProjectGanttTab';
import { ProjectReportsTab } from '../components/ProjectReportsTab';
import { ResourceUtilizationReportTab } from '../components/ResourceUtilizationReportTab';

const reportsProjectLimit = 100;

type ReportType = 'gantt' | 'resources' | 'budget' | 'status';

const reportOptions: readonly {
  type: ReportType;
  label: string;
  scope: string;
  icon: ReactNode;
}[] = [
  {
    type: 'gantt',
    label: 'Diagrama de Gantt',
    scope: 'Por proyecto',
    icon: <AccountTreeOutlinedIcon />,
  },
  {
    type: 'resources',
    label: 'Carga y utilizacion de recursos',
    scope: 'General con filtros',
    icon: <GroupsOutlinedIcon />,
  },
  {
    type: 'budget',
    label: 'Presupuesto vs costos reales',
    scope: 'Por proyecto',
    icon: <PaidOutlinedIcon />,
  },
  {
    type: 'status',
    label: 'Estado general',
    scope: 'Por proyecto',
    icon: <TrafficOutlinedIcon />,
  },
];

export function ReportsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryProjectUuid = searchParams.get('projectUuid') ?? '';
  const [projectOptions, setProjectOptions] = useState<Project[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);

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

  const selectedReportOption = useMemo(
    () => reportOptions.find((option) => option.type === selectedReportType) ?? null,
    [selectedReportType],
  );

  const handleProjectChange = (projectUuid: string) => {
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
          Seleccione el tipo de reporte y genere la vista correspondiente.
        </Typography>
      </Stack>

      {isLoadingProjects ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Stack alignItems="center" spacing={2} sx={{ py: 3 }}>
            <CircularProgress aria-label="Cargando proyectos para reportes" />
            <Typography color="text.secondary">Cargando proyectos disponibles</Typography>
          </Stack>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {error !== null ? <Alert severity="error">{error}</Alert> : null}
          {selectionWarning !== null ? <Alert severity="warning">{selectionWarning}</Alert> : null}
          <Box
            role="group"
            aria-label="Tipos de reportes disponibles"
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            {reportOptions.map((option) => (
              <Button
                key={option.type}
                variant={selectedReportType === option.type ? 'contained' : 'outlined'}
                startIcon={option.icon}
                onClick={() => {
                  setSelectedReportType(option.type);
                }}
                sx={{
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  minHeight: 72,
                  px: 2,
                  py: 1.25,
                  textAlign: 'left',
                  textTransform: 'none',
                }}
              >
                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                  <Typography variant="button" sx={{ lineHeight: 1.2 }}>
                    {option.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={selectedReportType === option.type ? 'inherit' : 'text.secondary'}
                  >
                    {option.scope}
                  </Typography>
                </Stack>
              </Button>
            ))}
          </Box>
        </Stack>
      )}

      {!isLoadingProjects && selectedReportOption === null ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}>
          <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center' }}>
            <AssessmentOutlinedIcon color="primary" aria-hidden="true" />
            <Typography component="h2" variant="h5">
              Elija un tipo de reporte
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {!isLoadingProjects && selectedReportType === 'resources' ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: { xs: 2, sm: 3 } }}>
          <ResourceUtilizationReportTab
            projectOptions={projectOptions}
            initialProjectUuid={queryProjectUuid}
          />
        </Paper>
      ) : null}

      {!isLoadingProjects &&
      selectedReportType !== null &&
      selectedReportType !== 'resources' ? (
        <ProjectScopedReportView
          reportType={selectedReportType}
          projectOptions={projectOptions}
          initialProjectUuid={queryProjectUuid}
          currentUserUuid={user?.uuid ?? ''}
          userRole={user?.role ?? 'USER'}
          onProjectChange={handleProjectChange}
        />
      ) : null}
    </Stack>
  );
}

function ProjectScopedReportView({
  reportType,
  projectOptions,
  initialProjectUuid,
  currentUserUuid,
  userRole,
  onProjectChange,
}: {
  reportType: Exclude<ReportType, 'resources'>;
  projectOptions: readonly Project[];
  initialProjectUuid: string;
  currentUserUuid: string;
  userRole: 'ADMIN' | 'PROJECT_MANAGER' | 'USER';
  onProjectChange: (projectUuid: string) => void;
}) {
  const [selectedProjectUuid, setSelectedProjectUuid] = useState(initialProjectUuid);

  useEffect(() => {
    setSelectedProjectUuid(initialProjectUuid);
  }, [initialProjectUuid, reportType]);

  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.uuid === selectedProjectUuid) ?? null,
    [projectOptions, selectedProjectUuid],
  );
  const canViewFinancialDetails =
    selectedProject !== null &&
    (userRole === 'ADMIN' ||
      (userRole === 'PROJECT_MANAGER' && selectedProject.managerUuid === currentUserUuid));

  const selectProject = (projectUuid: string) => {
    setSelectedProjectUuid(projectUuid);
    onProjectChange(projectUuid);
  };

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: { xs: 2, sm: 3 } }}>
      <Stack spacing={3}>
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

        {selectedProject === null ? (
          <Alert severity="info">Seleccione un proyecto para generar este reporte.</Alert>
        ) : null}

        {selectedProject !== null && reportType === 'gantt' ? (
          <ProjectGanttTab project={selectedProject} />
        ) : null}
        {selectedProject !== null && reportType === 'budget' ? (
          <ProjectReportsTab
            project={selectedProject}
            canViewFinancialDetails={canViewFinancialDetails}
            reportType="budget"
          />
        ) : null}
        {selectedProject !== null && reportType === 'status' ? (
          <ProjectReportsTab
            project={selectedProject}
            canViewFinancialDetails={canViewFinancialDetails}
            reportType="status"
          />
        ) : null}
      </Stack>
    </Paper>
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
