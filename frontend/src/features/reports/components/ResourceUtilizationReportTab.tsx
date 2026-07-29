import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
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
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getApiErrorMessage } from '../../../services/http/apiError';
import { Project } from '../../projects/types';
import { ResourceOperationalStatusChip } from '../../resources/components/ResourceOperationalStatusChip';
import {
  ResourceAssignmentTemporalStatus,
  ResourceCategory,
  getResourceAssignmentTemporalStatusLabel,
  getResourceCategoryLabel,
  resourceCategories,
} from '../../resources/types';
import { getProjectResourceUtilizationReport } from '../services/reportsApi';
import {
  ResourceCurrentAvailabilityStatus,
  ResourceUtilizationAssignment,
  ResourceUtilizationReport,
  getResourceCurrentAvailabilityStatusLabel,
} from '../types';

interface ResourceUtilizationReportTabProps {
  project: Project;
}

interface Filters {
  category: ResourceCategory | '';
  taskUuid: string;
  temporalStatus: ResourceAssignmentTemporalStatus | '';
}

const temporalStatuses: readonly ResourceAssignmentTemporalStatus[] = [
  'ACTIVA',
  'PROGRAMADA',
  'FINALIZADA',
];

export function ResourceUtilizationReportTab({ project }: ResourceUtilizationReportTabProps) {
  const [report, setReport] = useState<ResourceUtilizationReport | null>(null);
  const [filters, setFilters] = useState<Filters>({
    category: '',
    taskUuid: '',
    temporalStatus: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setReport(await getProjectResourceUtilizationReport(project.uuid));
    } catch (requestError: unknown) {
      setReport(null);
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsLoading(false);
    }
  }, [project.uuid]);

  useEffect(() => {
    setFilters({
      category: '',
      taskUuid: '',
      temporalStatus: '',
    });
    void loadReport();
  }, [loadReport]);

  const taskOptions = useMemo(() => buildTaskOptions(report?.assignments ?? []), [report]);
  const filteredAssignments = useMemo(
    () => filterAssignments(report?.assignments ?? [], filters),
    [filters, report],
  );
  const metrics = useMemo(() => {
    if (report === null) {
      return [];
    }

    return [
      {
        label: 'Recursos asignados',
        value: report.summary.totalAssignedResources.toString(),
      },
      {
        label: 'Asignaciones activas',
        value: report.summary.activeAssignments.toString(),
      },
      {
        label: 'Programadas',
        value: report.summary.scheduledAssignments.toString(),
      },
      {
        label: 'Finalizadas',
        value: report.summary.finishedAssignments.toString(),
      },
    ];
  }, [report]);

  if (isLoading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress aria-label="Cargando utilizacion de recursos" />
        <Typography color="text.secondary">Cargando utilizacion de recursos</Typography>
      </Stack>
    );
  }

  if (error !== null || report === null) {
    return <Alert severity="error">{error ?? 'No se pudo cargar la utilizacion de recursos.'}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="h5">
            Utilizacion de recursos
          </Typography>
          <Typography color="text.secondary">
            Equipos, licencias y servicios asignados por periodo, separados de la carga humana.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshOutlinedIcon />}
          onClick={() => {
            void loadReport();
          }}
        >
          Actualizar
        </Button>
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

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Table aria-label="Recursos por categoria">
          <TableHead>
            <TableRow>
              <TableCell>Categoria</TableCell>
              <TableCell align="right">Recursos</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.summary.resourcesByCategory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2}>
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">No hay recursos asignados.</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              report.summary.resourcesByCategory.map((item) => (
                <TableRow key={item.category} hover>
                  <TableCell>{getResourceCategoryLabel(item.category)}</TableCell>
                  <TableCell align="right">{item.count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Categoria"
            select
            fullWidth
            value={filters.category}
            onChange={(event) => {
              setFilters((currentFilters) => ({
                ...currentFilters,
                category: event.target.value as ResourceCategory | '',
              }));
            }}
          >
            <MenuItem value="">Todas</MenuItem>
            {resourceCategories.map((category) => (
              <MenuItem key={category} value={category}>
                {getResourceCategoryLabel(category)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Actividad"
            select
            fullWidth
            value={filters.taskUuid}
            onChange={(event) => {
              setFilters((currentFilters) => ({
                ...currentFilters,
                taskUuid: event.target.value,
              }));
            }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="__project__">Proyecto completo</MenuItem>
            {taskOptions.map((task) => (
              <MenuItem key={task.uuid} value={task.uuid}>
                {task.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Estado temporal"
            select
            fullWidth
            value={filters.temporalStatus}
            onChange={(event) => {
              setFilters((currentFilters) => ({
                ...currentFilters,
                temporalStatus: event.target.value as ResourceAssignmentTemporalStatus | '',
              }));
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {temporalStatuses.map((status) => (
              <MenuItem key={status} value={status}>
                {getResourceAssignmentTemporalStatusLabel(status)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Table aria-label="Asignaciones de recursos por periodo">
          <TableHead>
            <TableRow>
              <TableCell>Codigo</TableCell>
              <TableCell>Recurso</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell>Estado operativo</TableCell>
              <TableCell>Actividad asociada</TableCell>
              <TableCell>Fecha inicial</TableCell>
              <TableCell>Fecha final</TableCell>
              <TableCell>Estado temporal</TableCell>
              <TableCell align="right">Dias</TableCell>
              <TableCell>Disponibilidad actual</TableCell>
              <TableCell>Observaciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAssignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11}>
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No hay asignaciones de recursos para los filtros seleccionados.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              filteredAssignments.map((assignment) => (
                <TableRow key={assignment.uuid} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700 }}>{assignment.resourceCode}</Typography>
                  </TableCell>
                  <TableCell>{assignment.resourceName}</TableCell>
                  <TableCell>{getResourceCategoryLabel(assignment.resourceCategory)}</TableCell>
                  <TableCell>
                    <ResourceOperationalStatusChip status={assignment.operationalStatus} />
                  </TableCell>
                  <TableCell>{assignment.task?.name ?? 'Proyecto completo'}</TableCell>
                  <TableCell>{assignment.startDate}</TableCell>
                  <TableCell>{assignment.endDate}</TableCell>
                  <TableCell>
                    <TemporalStatusChip status={assignment.temporalStatus} />
                  </TableCell>
                  <TableCell align="right">{assignment.assignedDays}</TableCell>
                  <TableCell>
                    <CurrentAvailabilityChip status={assignment.currentAvailability} />
                  </TableCell>
                  <TableCell>{assignment.authorizedNotes ?? 'Sin observaciones'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function filterAssignments(
  assignments: readonly ResourceUtilizationAssignment[],
  filters: Filters,
): ResourceUtilizationAssignment[] {
  return assignments.filter((assignment) => {
    const categoryMatches =
      filters.category.length === 0 || assignment.resourceCategory === filters.category;
    const taskMatches =
      filters.taskUuid.length === 0 ||
      (filters.taskUuid === '__project__'
        ? assignment.task === null
        : assignment.task?.uuid === filters.taskUuid);
    const temporalStatusMatches =
      filters.temporalStatus.length === 0 || assignment.temporalStatus === filters.temporalStatus;

    return categoryMatches && taskMatches && temporalStatusMatches;
  });
}

function buildTaskOptions(
  assignments: readonly ResourceUtilizationAssignment[],
): NonNullable<ResourceUtilizationAssignment['task']>[] {
  const tasks = new Map<string, NonNullable<ResourceUtilizationAssignment['task']>>();

  assignments.forEach((assignment) => {
    if (assignment.task !== null) {
      tasks.set(assignment.task.uuid, assignment.task);
    }
  });

  return Array.from(tasks.values()).sort((firstTask, secondTask) =>
    firstTask.name.localeCompare(secondTask.name),
  );
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
