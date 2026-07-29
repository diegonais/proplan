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
import { formatPercentage } from '../../../utils/money';
import { useAuth } from '../../auth/authContext';
import { getRoleLabel } from '../../auth/types';
import { getProjectStatusLabel } from '../../projects/types';
import { TrafficLightChip } from '../../reports/components/TrafficLightChip';
import { getDashboardReport } from '../../reports/services/reportsApi';
import { DashboardReport } from '../../reports/types';

export function DashboardPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await getDashboardReport());
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    if (report === null) {
      return [];
    }

    return [
      { label: 'Proyectos activos', value: report.activeProjects.toString() },
      { label: 'Actividades pendientes', value: report.pendingTasks.toString() },
      { label: 'Miembros visibles', value: report.visibleMembers.toString() },
      { label: 'Recursos operativos', value: report.operationalResources.toString() },
      { label: 'Recursos asignados ahora', value: report.currentlyAssignedResources.toString() },
      { label: 'Recursos en mantenimiento', value: report.resourcesInMaintenance.toString() },
      { label: 'Avance promedio', value: formatPercentage(report.averageProgress) },
    ];
  }, [report]);

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h1" variant="h1">
          Panel general
        </Typography>
        <Typography color="text.secondary">
          Resumen de proyectos y actividades autorizadas para{' '}
          {user ? getRoleLabel(user.role) : 'el usuario'}.
        </Typography>
      </Stack>

      {isLoading ? (
        <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
          <CircularProgress aria-label="Cargando panel general" />
          <Typography color="text.secondary">Cargando panel general</Typography>
        </Stack>
      ) : null}

      {error !== null ? <Alert severity="error">{error}</Alert> : null}

      {!isLoading && report !== null ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, 1fr)',
              },
            }}
          >
            {metrics.map((metric) => (
              <Paper
                key={metric.label}
                elevation={0}
                sx={{ border: 1, borderColor: 'divider', p: 2 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography variant="h5">{metric.value}</Typography>
              </Paper>
            ))}
          </Box>

          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <Table aria-label="Resumen de proyectos">
              <TableHead>
                <TableRow>
                  <TableCell>Proyecto</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Semaforo</TableCell>
                  <TableCell>Fechas</TableCell>
                  <TableCell align="right">Avance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.projectSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Box sx={{ py: 5, textAlign: 'center' }}>
                        <Typography color="text.secondary">No hay proyectos visibles.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  report.projectSummaries.map((project) => (
                    <TableRow key={project.projectUuid} hover>
                      <TableCell>{project.name}</TableCell>
                      <TableCell>{getProjectStatusLabel(project.status)}</TableCell>
                      <TableCell>
                        <TrafficLightChip color={project.trafficLight} />
                      </TableCell>
                      <TableCell>
                        {project.startDate} a {project.endDate}
                      </TableCell>
                      <TableCell align="right">
                        <Stack spacing={0.5}>
                          <LinearProgress
                            variant="determinate"
                            value={Number(project.progressPercentage)}
                            sx={{ minWidth: 110 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {formatPercentage(project.progressPercentage)}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{ border: 1, borderColor: 'divider' }}
            >
              <Table aria-label="Proximos hitos">
                <TableHead>
                  <TableRow>
                    <TableCell>Proximo hito</TableCell>
                    <TableCell>Proyecto</TableCell>
                    <TableCell>Fecha fin</TableCell>
                    <TableCell align="right">Avance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.upcomingMilestones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                          <Typography color="text.secondary">
                            No hay hitos proximos derivados.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.upcomingMilestones.map((milestone) => (
                      <TableRow key={milestone.taskUuid} hover>
                        <TableCell>{milestone.name}</TableCell>
                        <TableCell>{milestone.projectName}</TableCell>
                        <TableCell>{milestone.endDate}</TableCell>
                        <TableCell align="right">{milestone.progress}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TableContainer
              component={Paper}
              elevation={0}
              sx={{ border: 1, borderColor: 'divider' }}
            >
              <Table aria-label="Carga de trabajo general">
                <TableHead>
                  <TableRow>
                    <TableCell>Recurso</TableCell>
                    <TableCell align="right">Horas asignadas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.workload.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                          <Typography color="text.secondary">
                            No hay carga de trabajo registrada.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.workload.slice(0, 8).map((item) => (
                      <TableRow key={`${item.projectUuid}-${item.userUuid}`} hover>
                        <TableCell>{item.user.name}</TableCell>
                        <TableCell align="right">{formatHours(item.assignedHours)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}

function formatHours(value: string): string {
  return `${new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 2,
  }).format(Number(value))} h`;
}
