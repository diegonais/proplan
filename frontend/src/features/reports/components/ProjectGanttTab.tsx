import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import { getApiErrorMessage } from '../../../services/http/apiError';
import { Project } from '../../projects/types';
import { getProjectGanttReport } from '../services/reportsApi';
import { GanttReport } from '../types';
import { GanttChart } from './GanttChart';

interface ProjectGanttTabProps {
  project: Project;
}

export function ProjectGanttTab({ project }: ProjectGanttTabProps) {
  const [report, setReport] = useState<GanttReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await getProjectGanttReport(project.uuid));
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [project.uuid]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  if (isLoading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress aria-label="Cargando diagrama de Gantt" />
        <Typography color="text.secondary">Cargando Gantt</Typography>
      </Stack>
    );
  }

  if (error !== null || report === null) {
    return <Alert severity="error">{error ?? 'No se pudo cargar el Gantt.'}</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}>
        <Typography component="h2" variant="h5">
          Diagrama de Gantt
        </Typography>
        <Typography color="text.secondary">{report.datePolicy}</Typography>
      </Stack>
      <GanttChart report={report} />
    </Stack>
  );
}
