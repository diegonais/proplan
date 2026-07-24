import {
  Alert,
  Box,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '../../../services/http/apiError';
import { formatMoney, formatPercentage } from '../../../utils/money';
import { Project } from '../../projects/types';
import { getTaskStatusLabel } from '../../tasks/types';
import {
  getProjectBudgetReport,
  getProjectStatusReport,
  getProjectWorkloadReport,
} from '../services/reportsApi';
import { ProjectBudgetReport, ProjectStatusReport } from '../types';
import { WorkloadItem } from '../../team/types';
import { TrafficLightChip } from './TrafficLightChip';

interface ProjectReportsTabProps {
  project: Project;
  canViewFinancialDetails: boolean;
}

export function ProjectReportsTab({ project, canViewFinancialDetails }: ProjectReportsTabProps) {
  const [statusReport, setStatusReport] = useState<ProjectStatusReport | null>(null);
  const [budgetReport, setBudgetReport] = useState<ProjectBudgetReport | null>(null);
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextStatusReport, nextWorkload, nextBudgetReport] = await Promise.all([
        getProjectStatusReport(project.uuid),
        getProjectWorkloadReport(project.uuid),
        canViewFinancialDetails ? getProjectBudgetReport(project.uuid) : Promise.resolve(null),
      ]);
      setStatusReport(nextStatusReport);
      setWorkload(nextWorkload);
      setBudgetReport(nextBudgetReport);
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setStatusReport(null);
      setWorkload([]);
      setBudgetReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [canViewFinancialDetails, project.uuid]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const metrics = useMemo(() => {
    if (statusReport === null) {
      return [];
    }

    return [
      { label: 'Progreso promedio', value: formatPercentage(statusReport.progressPercentage) },
      { label: 'Actividades totales', value: statusReport.totalTasks.toString() },
      { label: 'Actividades vencidas', value: statusReport.trafficLight.overdueTasksCount.toString() },
      {
        label: 'Porcentaje vencidas',
        value: formatPercentage(statusReport.trafficLight.overdueTasksPercentage),
      },
    ];
  }, [statusReport]);

  if (isLoading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress aria-label="Cargando reportes del proyecto" />
        <Typography color="text.secondary">Cargando reportes</Typography>
      </Stack>
    );
  }

  if (error !== null || statusReport === null) {
    return <Alert severity="error">{error ?? 'No se pudieron cargar los reportes.'}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="h5">
            Reportes
          </Typography>
          <Typography color="text.secondary">
            Carga, avance, presupuesto, actividades vencidas y estado general calculado.
          </Typography>
        </Box>
        <TrafficLightChip color={statusReport.trafficLight.color} />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, 1fr)' },
        }}
      >
        {metrics.map((metric) => (
          <Paper key={metric.label} elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {metric.label}
            </Typography>
            <Typography variant="h6">{metric.value}</Typography>
          </Paper>
        ))}
      </Box>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">Estado general</Typography>
          <Stack spacing={1}>
            {statusReport.trafficLight.reasons.map((reason) => (
              <Alert key={reason} severity={resolveAlertSeverity(statusReport.trafficLight.color)}>
                {reason}
              </Alert>
            ))}
          </Stack>
          <Stack spacing={0.75}>
            <Typography variant="body2" color="text.secondary">
              Avance del proyecto
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Number(statusReport.progressPercentage)}
              sx={{ height: 10, borderRadius: 1 }}
            />
          </Stack>
        </Stack>
      </Paper>

      {budgetReport !== null ? (
        <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <Table aria-label="Presupuesto contra costo">
            <TableHead>
              <TableRow>
                <TableCell>Indicador financiero</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Presupuesto aprobado</TableCell>
                <TableCell align="right">{formatMoney(budgetReport.approvedBudget)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Costo ejecutado</TableCell>
                <TableCell align="right">{formatMoney(budgetReport.totalActualCost)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Saldo</TableCell>
                <TableCell align="right">{formatMoney(budgetReport.balance)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Consumo</TableCell>
                <TableCell align="right">{formatPercentage(budgetReport.consumedPercentage)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Table aria-label="Carga por recurso">
          <TableHead>
            <TableRow>
              <TableCell>Recurso</TableCell>
              <TableCell align="right">Horas asignadas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workload.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2}>
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">No hay horas asignadas.</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              workload.map((item) => (
                <TableRow key={`${item.projectUuid}-${item.userUuid}`} hover>
                  <TableCell>{item.user.name}</TableCell>
                  <TableCell align="right">{formatHours(item.assignedHours)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Table aria-label="Actividades vencidas">
          <TableHead>
            <TableRow>
              <TableCell>Actividad vencida</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Progreso</TableCell>
              <TableCell>Fecha fin</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statusReport.trafficLight.overdueTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">No hay actividades vencidas.</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              statusReport.trafficLight.overdueTasks.map((task) => (
                <TableRow key={task.uuid} hover>
                  <TableCell>{task.name}</TableCell>
                  <TableCell>{getTaskStatusLabel(task.status)}</TableCell>
                  <TableCell align="right">{task.progress}%</TableCell>
                  <TableCell>{task.endDate}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function resolveAlertSeverity(color: ProjectStatusReport['trafficLight']['color']): 'success' | 'warning' | 'error' {
  const severities: Record<ProjectStatusReport['trafficLight']['color'], 'success' | 'warning' | 'error'> = {
    GREEN: 'success',
    YELLOW: 'warning',
    RED: 'error',
  };

  return severities[color];
}

function formatHours(value: string): string {
  return `${new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 2,
  }).format(Number(value))} h`;
}
