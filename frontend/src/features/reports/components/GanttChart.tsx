import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactNode } from 'react';

import { formatDateOnlyForDisplay, parseIsoDateOnly } from '../../../utils/dateTime';
import { getTaskDependencyTypeLabel, getTaskStatusLabel } from '../../tasks/types';
import { GanttReport, GanttTaskReportItem } from '../types';

interface GanttChartProps {
  report: GanttReport;
  compact?: boolean;
}

const dayWidth = 28;

export function GanttChart({ report, compact = false }: GanttChartProps) {
  const totalDays = daysBetweenInclusive(report.projectStartDate, report.projectEndDate);
  const rows = compact ? report.tasks.slice(0, 6) : report.tasks;

  if (report.tasks.length === 0) {
    return (
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No hay actividades para visualizar en el Gantt.</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ overflowX: 'auto' }}>
        <Box
          sx={{
            minWidth: Math.max(totalDays * dayWidth + 280, 680),
            display: 'grid',
            gridTemplateColumns: '260px 1fr',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
          }}
        >
          <HeaderCell>Actividad</HeaderCell>
          <HeaderCell>
            {formatDateOnlyForDisplay(report.projectStartDate)} a{' '}
            {formatDateOnlyForDisplay(report.projectEndDate)}
          </HeaderCell>
          {rows.map((task) => (
            <GanttRow key={task.uuid} task={task} projectStartDate={report.projectStartDate} />
          ))}
        </Box>
      </Box>

      {!compact ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {report.dependencies.length === 0 ? (
            <Typography color="text.secondary">No hay dependencias registradas.</Typography>
          ) : (
            report.dependencies.map((dependency) => {
              const predecessor = report.tasks.find(
                (task) => task.uuid === dependency.predecessorTaskUuid,
              );
              const successor = report.tasks.find((task) => task.uuid === dependency.successorTaskUuid);

              return (
                <Tooltip key={dependency.uuid} title={getTaskDependencyTypeLabel(dependency.dependencyType)}>
                  <Chip
                    icon={<LinkOutlinedIcon />}
                    label={`${predecessor?.name ?? 'Actividad'} -> ${successor?.name ?? 'Actividad'}`}
                    variant="outlined"
                  />
                </Tooltip>
              );
            })
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
        fontWeight: 700,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {children}
      </Typography>
    </Box>
  );
}

function GanttRow({ task, projectStartDate }: { task: GanttTaskReportItem; projectStartDate: string }) {
  const offset = daysBetweenInclusive(projectStartDate, task.startDate) - 1;
  const duration = daysBetweenInclusive(task.startDate, task.endDate);
  const displayedDays = daysBetweenInclusive(projectStartDate, task.endDate);
  const gridStart = Math.max(offset + 1, 1);
  const gridSpan = Math.max(duration, 1);

  return (
    <>
      <Box
        sx={{
          minHeight: 58,
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Stack spacing={0.5} sx={{ pl: task.level * 2, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            {task.level > 0 ? <AccountTreeOutlinedIcon color="action" fontSize="small" /> : null}
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {task.name}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" noWrap>
            {getTaskStatusLabel(task.status)} - {task.startDate} a {task.endDate}
          </Typography>
        </Stack>
      </Box>
      <Box
        sx={{
          minHeight: 58,
          px: 1,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'grid',
          gridTemplateColumns: `repeat(${String(Math.max(displayedDays, 1))}, ${String(dayWidth)}px)`,
          alignItems: 'center',
        }}
      >
        <Tooltip title={`${String(task.progress)}% completado`}>
          <Box
            sx={{
              gridColumn: `${String(gridStart)} / span ${String(gridSpan)}`,
              borderRadius: 1,
              border: 1,
              borderColor: 'primary.main',
              bgcolor: 'background.default',
              overflow: 'hidden',
              minHeight: 28,
              display: 'flex',
              alignItems: 'center',
              px: 1,
            }}
          >
            <LinearProgress
              variant="determinate"
              value={task.progress}
              sx={{ flex: 1, height: 8, borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ ml: 1, fontWeight: 700 }}>
              {task.progress}%
            </Typography>
          </Box>
        </Tooltip>
      </Box>
    </>
  );
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = parseIsoDateOnly(startDate);
  const end = parseIsoDateOnly(endDate);
  const startTime = Date.UTC(start.year, start.monthIndex, start.day, 12, 0, 0);
  const endTime = Date.UTC(end.year, end.monthIndex, end.day, 12, 0, 0);
  const dayInMilliseconds = 24 * 60 * 60 * 1000;

  return Math.max(Math.floor((endTime - startTime) / dayInMilliseconds) + 1, 1);
}
