import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import {
  Alert,
  Box,
  Button,
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

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { formatMoney, formatPercentage } from '../../../utils/money';
import { Project } from '../../projects/types';
import { getTaskStatusLabel } from '../../tasks/types';
import { WorkloadItem } from '../../team/types';
import {
  downloadProjectExcelExport,
  downloadProjectPdfExport,
  getProjectBudgetReport,
  getProjectStatusReport,
  getProjectWorkloadReport,
  ProjectExportDownload,
} from '../services/reportsApi';
import { ProjectBudgetReport, ProjectStatusReport } from '../types';
import { TrafficLightChip } from './TrafficLightChip';

type CoreReportType = 'workload' | 'budget' | 'status';

interface ProjectReportsTabProps {
  project: Project;
  canViewFinancialDetails: boolean;
  reportType: CoreReportType;
}

export function ProjectReportsTab({
  project,
  canViewFinancialDetails,
  reportType,
}: ProjectReportsTabProps) {
  const [statusReport, setStatusReport] = useState<ProjectStatusReport | null>(null);
  const [budgetReport, setBudgetReport] = useState<ProjectBudgetReport | null>(null);
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showNotification } = useNotifications();

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setStatusReport(null);
    setBudgetReport(null);
    setWorkload([]);

    try {
      if (reportType === 'workload') {
        setWorkload(await getProjectWorkloadReport(project.uuid));
      }

      if (reportType === 'budget' && canViewFinancialDetails) {
        setBudgetReport(await getProjectBudgetReport(project.uuid));
      }

      if (reportType === 'status') {
        setStatusReport(await getProjectStatusReport(project.uuid));
      }
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setStatusReport(null);
      setWorkload([]);
      setBudgetReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [canViewFinancialDetails, project.uuid, reportType]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleDownload = async (format: 'pdf' | 'excel') => {
    setDownloadingFormat(format);
    try {
      const file =
        format === 'pdf'
          ? await downloadProjectPdfExport(project.uuid)
          : await downloadProjectExcelExport(project.uuid);
      triggerBrowserDownload(file);
      showNotification('Exportacion generada correctamente.', 'success');
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const workloadMetrics = useMemo(() => {
    const totalHours = workload.reduce((sum, item) => sum + Number(item.assignedHours), 0);

    return [
      { label: 'Recursos humanos con horas', value: workload.length.toString() },
      { label: 'Horas asignadas al equipo', value: formatHours(totalHours.toFixed(2)) },
    ];
  }, [workload]);

  const statusMetrics = useMemo(() => {
    if (statusReport === null) {
      return [];
    }

    return [
      { label: 'Progreso promedio', value: formatPercentage(statusReport.progressPercentage) },
      { label: 'Actividades totales', value: statusReport.totalTasks.toString() },
      { label: 'Actividades activas', value: statusReport.activeNonCancelledTasks.toString() },
      {
        label: 'Actividades vencidas',
        value: statusReport.trafficLight.overdueTasksCount.toString(),
      },
    ];
  }, [statusReport]);

  if (isLoading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress aria-label="Cargando reporte del proyecto" />
        <Typography color="text.secondary">Cargando reporte</Typography>
      </Stack>
    );
  }

  if (error !== null) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (reportType === 'workload') {
    return (
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography component="h2" variant="h5">
            Carga de trabajo por recurso humano
          </Typography>
          <Typography color="text.secondary">
            Horas asignadas a cada miembro del equipo del proyecto.
          </Typography>
        </Stack>

        <MetricGrid metrics={workloadMetrics} />

        <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <Table aria-label="Carga de trabajo humana por persona">
            <TableHead>
              <TableRow>
                <TableCell>Recurso humano</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell align="right">Horas asignadas</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workload.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                      <Typography color="text.secondary">No hay horas asignadas.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                workload.map((item) => (
                  <TableRow key={`${item.projectUuid}-${item.userUuid}`} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{item.user.name}</Typography>
                    </TableCell>
                    <TableCell>{item.user.email}</TableCell>
                    <TableCell align="right">{formatHours(item.assignedHours)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    );
  }

  if (reportType === 'budget') {
    if (!canViewFinancialDetails) {
      return (
        <Alert severity="warning">
          No tiene permiso para consultar presupuesto y costos reales de este proyecto.
        </Alert>
      );
    }

    if (budgetReport === null) {
      return <Alert severity="error">No se pudo cargar el reporte financiero.</Alert>;
    }

    const consumedPercentage = Number(budgetReport.consumedPercentage);

    return (
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography component="h2" variant="h5">
              Presupuesto vs costos reales
            </Typography>
            <Typography color="text.secondary">
              Comparativa entre presupuesto aprobado, presupuesto distribuido y costo ejecutado.
            </Typography>
          </Box>
          <ExportButtons
            downloadingFormat={downloadingFormat}
            onDownload={(format) => {
              void handleDownload(format);
            }}
          />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, 1fr)' },
          }}
        >
          {[
            { label: 'Presupuesto aprobado', value: formatMoney(budgetReport.approvedBudget) },
            { label: 'Presupuesto distribuido', value: formatMoney(budgetReport.distributedBudget) },
            { label: 'Costo real ejecutado', value: formatMoney(budgetReport.totalActualCost) },
            { label: 'Saldo disponible', value: formatMoney(budgetReport.balance) },
          ].map((metric) => (
            <Paper key={metric.label} elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {metric.label}
              </Typography>
              <Typography variant="h6">{metric.value}</Typography>
            </Paper>
          ))}
        </Box>

        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Consumo del presupuesto aprobado
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatPercentage(budgetReport.consumedPercentage)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(Math.max(consumedPercentage, 0), 100)}
              color={consumedPercentage > 100 ? 'error' : consumedPercentage >= 80 ? 'warning' : 'primary'}
              sx={{ height: 10, borderRadius: 1 }}
            />
          </Stack>
        </Paper>

        <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
          <Table aria-label="Presupuesto versus costos reales">
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
                <TableCell>Presupuesto distribuido en actividades</TableCell>
                <TableCell align="right">{formatMoney(budgetReport.distributedBudget)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Costos reales ejecutados</TableCell>
                <TableCell align="right">{formatMoney(budgetReport.totalActualCost)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Variacion contra presupuesto</TableCell>
                <TableCell align="right">{formatMoney(budgetReport.variance)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Saldo disponible</TableCell>
                <TableCell align="right">{formatMoney(budgetReport.balance)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Porcentaje consumido</TableCell>
                <TableCell align="right">{formatPercentage(budgetReport.consumedPercentage)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    );
  }

  if (statusReport === null) {
    return <Alert severity="error">No se pudo cargar el estado general del proyecto.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="h5">
            Estado general del proyecto
          </Typography>
          <Typography color="text.secondary">
            Informe tipo semaforo con avance, vencimientos y razones del estado.
          </Typography>
        </Box>
        <TrafficLightChip color={statusReport.trafficLight.color} />
      </Stack>

      <MetricGrid metrics={statusMetrics} />

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        <Stack spacing={1.5}>
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

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Table aria-label="Actividades por estado">
          <TableHead>
            <TableRow>
              <TableCell>Estado de actividad</TableCell>
              <TableCell align="right">Cantidad</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statusReport.taskStatusCounts.map((item) => (
              <TableRow key={item.status} hover>
                <TableCell>{getTaskStatusLabel(item.status)}</TableCell>
                <TableCell align="right">{item.count}</TableCell>
              </TableRow>
            ))}
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

function MetricGrid({ metrics }: { metrics: readonly { label: string; value: string }[] }) {
  return (
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
  );
}

function ExportButtons({
  downloadingFormat,
  onDownload,
}: {
  downloadingFormat: 'pdf' | 'excel' | null;
  onDownload: (format: 'pdf' | 'excel') => void;
}) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
      <Button
        variant="outlined"
        startIcon={
          downloadingFormat === 'pdf' ? (
            <CircularProgress size={18} aria-label="Descargando PDF" />
          ) : (
            <PictureAsPdfOutlinedIcon />
          )
        }
        disabled={downloadingFormat !== null}
        onClick={() => {
          onDownload('pdf');
        }}
      >
        Exportar PDF
      </Button>
      <Button
        variant="outlined"
        startIcon={
          downloadingFormat === 'excel' ? (
            <CircularProgress size={18} aria-label="Descargando Excel" />
          ) : (
            <TableChartOutlinedIcon />
          )
        }
        disabled={downloadingFormat !== null}
        onClick={() => {
          onDownload('excel');
        }}
      >
        Exportar Excel
      </Button>
    </Stack>
  );
}

function triggerBrowserDownload(file: ProjectExportDownload): void {
  const objectUrl = URL.createObjectURL(file.blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = file.fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
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
