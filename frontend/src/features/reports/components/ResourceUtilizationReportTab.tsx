import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { Project } from '../../projects/types';
import { ResourceOperationalStatusChip } from '../../resources/components/ResourceOperationalStatusChip';
import {
  ResourceAssignmentTemporalStatus,
  getResourceAssignmentTemporalStatusLabel,
  getResourceCategoryLabel,
} from '../../resources/types';
import {
  downloadResourcesExcelExport,
  downloadResourcesPdfExport,
  getResourcesReport,
  ProjectExportDownload,
  ResourcesReportParams,
} from '../services/reportsApi';
import {
  ResourceCurrentAvailabilityStatus,
  ResourcesReport,
  ResourcesReportItem,
  ResourcesReportTypeFilter,
  getResourceCurrentAvailabilityStatusLabel,
  getResourcesReportItemTypeLabel,
  getResourcesReportTypeFilterLabel,
} from '../types';

interface ResourceUtilizationReportTabProps {
  projectOptions: readonly Project[];
  initialProjectUuid?: string;
}

interface Filters {
  periodMode: 'month' | 'range';
  month: string;
  startDate: string;
  endDate: string;
  projectUuid: string;
  resourceType: ResourcesReportTypeFilter;
}

const resourceTypeOptions: readonly ResourcesReportTypeFilter[] = ['ALL', 'HUMAN', 'MATERIAL'];

export function ResourceUtilizationReportTab({
  projectOptions,
  initialProjectUuid = '',
}: ResourceUtilizationReportTabProps) {
  const [report, setReport] = useState<ResourcesReport | null>(null);
  const [filters, setFilters] = useState<Filters>({
    periodMode: 'month',
    month: '',
    startDate: '',
    endDate: '',
    projectUuid: initialProjectUuid,
    resourceType: 'ALL',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showNotification } = useNotifications();

  const canGenerate = isValidFilterSelection(filters);

  const updateFilters = (nextFilters: Partial<Filters>) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      ...nextFilters,
    }));
    setReport(null);
    setHasGeneratedReport(false);
    setError(null);
  };

  const loadReport = useCallback(async () => {
    if (!isValidFilterSelection(filters)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setReport(
        await getResourcesReport({
          projectUuid: filters.projectUuid,
          resourceType: filters.resourceType,
          month: filters.periodMode === 'month' ? filters.month : undefined,
          startDate: filters.periodMode === 'range' ? filters.startDate : undefined,
          endDate: filters.periodMode === 'range' ? filters.endDate : undefined,
        }),
      );
      setHasGeneratedReport(true);
    } catch (requestError: unknown) {
      setReport(null);
      setHasGeneratedReport(true);
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const handleDownload = async (format: 'pdf' | 'excel') => {
    if (!isValidFilterSelection(filters)) {
      return;
    }

    setDownloadingFormat(format);
    try {
      const params = buildResourcesReportParams(filters);
      const file =
        format === 'pdf'
          ? await downloadResourcesPdfExport(params)
          : await downloadResourcesExcelExport(params);
      triggerBrowserDownload(file);
      showNotification('Exportacion generada correctamente.', 'success');
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handlePreview = async () => {
    if (!isValidFilterSelection(filters)) {
      return;
    }

    setIsPreviewing(true);
    try {
      const file = await downloadResourcesPdfExport(buildResourcesReportParams(filters));
      if (!openPdfPreview(file)) {
        showNotification('Permita ventanas emergentes para previsualizar el PDF.', 'warning');
      }
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsPreviewing(false);
    }
  };

  const metrics = useMemo(() => {
    if (report === null) {
      return [];
    }

    return [
      {
        label: 'Recursos humanos',
        value: report.summary.totalHumanResources.toString(),
      },
      {
        label: 'Recursos materiales',
        value: report.summary.totalMaterialResources.toString(),
      },
      {
        label: 'Horas humanas',
        value: formatHours(report.summary.totalAssignedHours),
      },
      {
        label: 'Dias materiales',
        value: report.summary.totalMaterialAssignmentDays.toString(),
      },
    ];
  }, [report]);

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography component="h2" variant="h5">
          Carga y utilizacion de recursos
        </Typography>
        <Typography color="text.secondary">
          Reporte general con filtros por periodo, proyecto y alcance de recursos.
        </Typography>
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Periodo"
              select
              fullWidth
              value={filters.periodMode}
              onChange={(event) => {
                updateFilters({
                  periodMode: event.target.value as Filters['periodMode'],
                  month: '',
                  startDate: '',
                  endDate: '',
                });
              }}
            >
              <MenuItem value="month">Mes</MenuItem>
              <MenuItem value="range">Rango de fechas</MenuItem>
            </TextField>
            {filters.periodMode === 'month' ? (
              <TextField
                label="Mes"
                type="month"
                fullWidth
                value={filters.month}
                onChange={(event) => {
                  updateFilters({ month: event.target.value });
                }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            ) : (
              <>
                <TextField
                  label="Fecha inicial"
                  type="date"
                  fullWidth
                  value={filters.startDate}
                  onChange={(event) => {
                    updateFilters({ startDate: event.target.value });
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Fecha final"
                  type="date"
                  fullWidth
                  value={filters.endDate}
                  onChange={(event) => {
                    updateFilters({ endDate: event.target.value });
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </>
            )}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Proyecto"
              select
              fullWidth
              value={filters.projectUuid}
              onChange={(event) => {
                updateFilters({ projectUuid: event.target.value });
              }}
              helperText="Opcional para consultar todos los proyectos disponibles."
            >
              <MenuItem value="">Todos los proyectos</MenuItem>
              {projectOptions.map((project) => (
                <MenuItem key={project.uuid} value={project.uuid}>
                  {project.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Alcance de recursos"
              select
              fullWidth
              value={filters.resourceType}
              onChange={(event) => {
                updateFilters({ resourceType: event.target.value as ResourcesReportTypeFilter });
              }}
            >
              {resourceTypeOptions.map((type) => (
                <MenuItem key={type} value={type}>
                  {getResourcesReportTypeFilterLabel(type)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {filters.periodMode === 'range' &&
          filters.startDate.length > 0 &&
          filters.endDate.length > 0 &&
          filters.startDate > filters.endDate ? (
            <Alert severity="warning">La fecha final debe ser mayor o igual a la fecha inicial.</Alert>
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              startIcon={
                isLoading ? (
                  <CircularProgress size={18} aria-label="Generando reporte de recursos" />
                ) : (
                  <SearchOutlinedIcon />
                )
              }
              disabled={!canGenerate || isLoading}
              onClick={() => {
                void loadReport();
              }}
            >
              Generar reporte
            </Button>
            {hasGeneratedReport ? (
              <Button
                variant="outlined"
                startIcon={<RefreshOutlinedIcon />}
                disabled={!canGenerate || isLoading}
                onClick={() => {
                  void loadReport();
                }}
              >
                Actualizar
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      {!hasGeneratedReport ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}>
          <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center' }}>
            <SearchOutlinedIcon color="primary" aria-hidden="true" />
            <Typography component="h3" variant="h6">
              Seleccione filtros y genere el reporte
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {isLoading ? (
        <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
          <CircularProgress aria-label="Cargando carga y utilizacion de recursos" />
          <Typography color="text.secondary">Generando reporte</Typography>
        </Stack>
      ) : null}

      {!isLoading && error !== null ? <Alert severity="error">{error}</Alert> : null}

      {!isLoading && report !== null ? (
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={
                isPreviewing ? (
                  <CircularProgress size={18} aria-label="Generando previsualizacion" />
                ) : (
                  <VisibilityOutlinedIcon />
                )
              }
              disabled={downloadingFormat !== null || isPreviewing}
              onClick={() => {
                void handlePreview();
              }}
            >
              Previsualizar
            </Button>
            <Button
              variant="outlined"
              startIcon={
                downloadingFormat === 'pdf' ? (
                  <CircularProgress size={18} aria-label="Descargando PDF" />
                ) : (
                  <PictureAsPdfOutlinedIcon />
                )
              }
              disabled={downloadingFormat !== null || isPreviewing}
              onClick={() => {
                void handleDownload('pdf');
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
              disabled={downloadingFormat !== null || isPreviewing}
              onClick={() => {
                void handleDownload('excel');
              }}
            >
              Exportar Excel
            </Button>
          </Stack>
          <MetricGrid metrics={metrics} />
          <Typography variant="body2" color="text.secondary">
            {report.datePolicy}
          </Typography>
          <ResourcesReportTable items={report.items} />
        </Stack>
      ) : null}
    </Stack>
  );
}

function buildResourcesReportParams(filters: Filters): ResourcesReportParams {
  return {
    projectUuid: filters.projectUuid,
    resourceType: filters.resourceType,
    month: filters.periodMode === 'month' ? filters.month : undefined,
    startDate: filters.periodMode === 'range' ? filters.startDate : undefined,
    endDate: filters.periodMode === 'range' ? filters.endDate : undefined,
  };
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

function openPdfPreview(file: ProjectExportDownload): boolean {
  const objectUrl = URL.createObjectURL(file.blob);
  const previewWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');

  if (previewWindow === null) {
    URL.revokeObjectURL(objectUrl);
    return false;
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60000);

  return true;
}

function ResourcesReportTable({ items }: { items: readonly ResourcesReportItem[] }) {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
      <Table aria-label="Carga y utilizacion de recursos">
        <TableHead>
          <TableRow>
            <TableCell>Tipo</TableCell>
            <TableCell>Proyecto</TableCell>
            <TableCell>Recurso</TableCell>
            <TableCell>Detalle</TableCell>
            <TableCell align="right">Horas</TableCell>
            <TableCell align="right">Dias</TableCell>
            <TableCell>Periodo</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell>Observaciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9}>
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No hay recursos para los filtros seleccionados.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => (
              <TableRow
                key={`${item.itemType}-${item.projectUuid}-${item.resourceName}-${index.toString()}`}
                hover
              >
                <TableCell>
                  <Chip
                    label={getResourcesReportItemTypeLabel(item.itemType)}
                    size="small"
                    color={item.itemType === 'HUMAN' ? 'primary' : 'info'}
                    variant={item.itemType === 'HUMAN' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>{item.projectName}</TableCell>
                <TableCell>
                  <Typography sx={{ fontWeight: 700 }}>{item.resourceName}</Typography>
                  {item.resourceCode !== null ? (
                    <Typography variant="body2" color="text.secondary">
                      {item.resourceCode}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>{renderResourceDetail(item)}</TableCell>
                <TableCell align="right">
                  {item.assignedHours === null ? 'No aplica' : formatHours(item.assignedHours)}
                </TableCell>
                <TableCell align="right">{item.assignedDays ?? 'No aplica'}</TableCell>
                <TableCell>{formatPeriod(item)}</TableCell>
                <TableCell>{renderStatus(item)}</TableCell>
                <TableCell>{item.authorizedNotes ?? 'Sin observaciones'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
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

function renderResourceDetail(item: ResourcesReportItem) {
  if (item.itemType === 'HUMAN') {
    return item.user?.email ?? 'Sin correo';
  }

  return item.resourceCategory === null ? 'Sin categoria' : getResourceCategoryLabel(item.resourceCategory);
}

function renderStatus(item: ResourcesReportItem) {
  if (item.itemType === 'HUMAN') {
    return 'Horas asignadas';
  }

  return (
    <Stack spacing={0.75} alignItems="flex-start">
      {item.operationalStatus !== null ? (
        <ResourceOperationalStatusChip status={item.operationalStatus} />
      ) : null}
      {item.temporalStatus !== null ? <TemporalStatusChip status={item.temporalStatus} /> : null}
      {item.currentAvailability !== null ? (
        <CurrentAvailabilityChip status={item.currentAvailability} />
      ) : null}
    </Stack>
  );
}

function formatPeriod(item: ResourcesReportItem): string {
  if (item.startDate === null || item.endDate === null) {
    return 'Periodo filtrado';
  }

  return `${item.startDate} al ${item.endDate}`;
}

function TemporalStatusChip({ status }: { status: ResourceAssignmentTemporalStatus }) {
  const chipColor =
    status === 'ACTIVA' ? 'success' : status === 'PROGRAMADA' ? 'info' : 'default';

  return (
    <Chip
      label={getResourceAssignmentTemporalStatusLabel(status)}
      color={chipColor}
      size="small"
      variant={status === 'ACTIVA' ? 'filled' : 'outlined'}
    />
  );
}

function CurrentAvailabilityChip({ status }: { status: ResourceCurrentAvailabilityStatus }) {
  const chipColor =
    status === 'DISPONIBLE'
      ? 'success'
      : status === 'ASIGNADO'
        ? 'info'
        : status === 'ELIMINADO'
          ? 'default'
          : 'warning';

  return (
    <Chip
      label={getResourceCurrentAvailabilityStatusLabel(status)}
      color={chipColor}
      size="small"
      variant={status === 'DISPONIBLE' ? 'filled' : 'outlined'}
    />
  );
}

function isValidFilterSelection(filters: Filters): boolean {
  if (filters.periodMode === 'month') {
    return filters.month.length > 0;
  }

  return (
    filters.startDate.length > 0 &&
    filters.endDate.length > 0 &&
    filters.startDate <= filters.endDate
  );
}

function formatHours(value: string): string {
  return `${new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 2,
  }).format(Number(value))} h`;
}
