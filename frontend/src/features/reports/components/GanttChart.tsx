import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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

interface TimelineDay {
  isoDate: string;
  dayOfMonth: string;
  weekdayLabel: string;
  isWeekend: boolean;
  isToday: boolean;
}

interface MonthSegment {
  key: string;
  label: string;
  startIndex: number;
  span: number;
}

const dayWidth = 42;
const activityColumnWidth = 300;

export function GanttChart({ report, compact = false }: GanttChartProps) {
  const timelineDays = buildTimelineDays(report.projectStartDate, report.projectEndDate);
  const monthSegments = buildMonthSegments(timelineDays);
  const rows = compact ? report.tasks.slice(0, 6) : report.tasks;

  if (report.tasks.length === 0) {
    return (
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No hay actividades para visualizar en el Gantt.</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarMonthOutlinedIcon color="primary" aria-hidden="true" />
          <Typography variant="h6">Calendario del proyecto</Typography>
        </Stack>
        <Box sx={{ overflowX: 'auto' }}>
          <Box
            sx={{
              minWidth: activityColumnWidth + timelineDays.length * dayWidth,
              display: 'grid',
              gridTemplateColumns: `${String(activityColumnWidth)}px repeat(${String(
                timelineDays.length,
              )}, ${String(dayWidth)}px)`,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            <HeaderCell sx={{ gridColumn: '1', gridRow: '1 / span 2' }}>Actividad</HeaderCell>
            {monthSegments.map((segment) => (
              <HeaderCell
                key={segment.key}
                sx={{
                  gridColumn: `${String(segment.startIndex + 2)} / span ${String(segment.span)}`,
                  gridRow: '1',
                  textAlign: 'center',
                }}
              >
                {segment.label}
              </HeaderCell>
            ))}
            {timelineDays.map((day, index) => (
              <HeaderDayCell key={day.isoDate} day={day} columnIndex={index + 2} />
            ))}
            {rows.map((task, index) => (
              <GanttRow
                key={task.uuid}
                task={task}
                timelineDays={timelineDays}
                rowIndex={index + 3}
                projectStartDate={report.projectStartDate}
              />
            ))}
          </Box>
        </Box>
      </Stack>

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Table aria-label="Detalle calendario de actividades">
          <TableHead>
            <TableRow>
              <TableCell>Actividad</TableCell>
              <TableCell>Fecha inicial</TableCell>
              <TableCell>Fecha final</TableCell>
              <TableCell align="right">Duracion</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Avance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((task) => (
              <TableRow key={task.uuid} hover>
                <TableCell>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pl: task.level * 2 }}>
                    {task.level > 0 ? <AccountTreeOutlinedIcon color="action" fontSize="small" /> : null}
                    <Typography sx={{ fontWeight: 700 }}>{task.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{formatDateOnlyForDisplay(task.startDate)}</TableCell>
                <TableCell>{formatDateOnlyForDisplay(task.endDate)}</TableCell>
                <TableCell align="right">{daysBetweenInclusive(task.startDate, task.endDate)} dias</TableCell>
                <TableCell>{getTaskStatusLabel(task.status)}</TableCell>
                <TableCell align="right">{task.progress}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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

function HeaderCell({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        ...sx,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {children}
      </Typography>
    </Box>
  );
}

function HeaderDayCell({ day, columnIndex }: { day: TimelineDay; columnIndex: number }) {
  return (
    <Box
      sx={{
        gridColumn: String(columnIndex),
        gridRow: '2',
        borderBottom: 1,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: day.isToday ? 'primary.light' : day.isWeekend ? 'action.hover' : 'background.paper',
        color: day.isToday ? 'primary.contrastText' : 'text.primary',
        minHeight: 56,
        px: 0.5,
        py: 0.75,
        textAlign: 'center',
      }}
    >
      <Typography variant="caption" component="div" sx={{ fontWeight: 700 }}>
        {day.dayOfMonth}
      </Typography>
      <Typography variant="caption" component="div">
        {day.weekdayLabel}
      </Typography>
    </Box>
  );
}

function GanttRow({
  task,
  timelineDays,
  rowIndex,
  projectStartDate,
}: {
  task: GanttTaskReportItem;
  timelineDays: readonly TimelineDay[];
  rowIndex: number;
  projectStartDate: string;
}) {
  const offset = daysBetweenInclusive(projectStartDate, task.startDate) - 1;
  const duration = daysBetweenInclusive(task.startDate, task.endDate);
  const gridStart = Math.max(offset + 1, 1);
  const gridSpan = Math.max(duration, 1);

  return (
    <>
      <Box
        sx={{
          gridColumn: '1',
          gridRow: String(rowIndex),
          minHeight: 64,
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderRight: 1,
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
            {formatDateOnlyForDisplay(task.startDate)} a {formatDateOnlyForDisplay(task.endDate)}
          </Typography>
        </Stack>
      </Box>
      <Box
        sx={{
          gridColumn: `2 / span ${String(timelineDays.length)}`,
          gridRow: String(rowIndex),
          minHeight: 64,
          display: 'grid',
          gridTemplateColumns: `repeat(${String(timelineDays.length)}, ${String(dayWidth)}px)`,
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          position: 'relative',
        }}
      >
        {timelineDays.map((day) => (
          <Box
            key={day.isoDate}
            sx={{
              minHeight: 64,
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: day.isToday
                ? 'rgba(25, 118, 210, 0.10)'
                : day.isWeekend
                  ? 'action.hover'
                  : 'transparent',
            }}
          />
        ))}
        <Tooltip
          title={`${task.name}: ${formatDateOnlyForDisplay(task.startDate)} a ${formatDateOnlyForDisplay(
            task.endDate,
          )}. ${String(task.progress)}% completado.`}
        >
          <Box
            sx={{
              gridColumn: `${String(gridStart)} / span ${String(gridSpan)}`,
              gridRow: '1',
              borderRadius: 1,
              border: 1,
              borderColor: 'primary.main',
              bgcolor: 'background.default',
              overflow: 'hidden',
              minHeight: 32,
              display: 'flex',
              alignItems: 'center',
              px: 1,
              mx: 0.5,
              zIndex: 1,
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

function buildTimelineDays(startDate: string, endDate: string): TimelineDay[] {
  const days: TimelineDay[] = [];
  const current = toUtcNoonDate(startDate);
  const end = toUtcNoonDate(endDate);
  const todayIsoDate = getTodayIsoDate();
  const weekdayFormatter = new Intl.DateTimeFormat('es-BO', {
    weekday: 'short',
    timeZone: 'UTC',
  });

  while (current.getTime() <= end.getTime()) {
    const isoDate = formatUtcDateOnly(current);
    const weekday = current.getUTCDay();

    days.push({
      isoDate,
      dayOfMonth: String(current.getUTCDate()).padStart(2, '0'),
      weekdayLabel: weekdayFormatter.format(current).replace('.', ''),
      isWeekend: weekday === 0 || weekday === 6,
      isToday: isoDate === todayIsoDate,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

function buildMonthSegments(days: readonly TimelineDay[]): MonthSegment[] {
  const formatter = new Intl.DateTimeFormat('es-BO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const segments: MonthSegment[] = [];

  days.forEach((day, index) => {
    const monthLabel = formatter.format(toUtcNoonDate(day.isoDate));
    const previousSegment = segments.at(-1);

    if (previousSegment !== undefined && previousSegment.label === monthLabel) {
      previousSegment.span += 1;
      return;
    }

    segments.push({
      key: `${monthLabel}-${String(index)}`,
      label: monthLabel,
      startIndex: index,
      span: 1,
    });
  });

  return segments;
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = toUtcNoonDate(startDate);
  const end = toUtcNoonDate(endDate);
  const dayInMilliseconds = 24 * 60 * 60 * 1000;

  return Math.max(Math.floor((end.getTime() - start.getTime()) / dayInMilliseconds) + 1, 1);
}

function toUtcNoonDate(value: string): Date {
  const dateParts = parseIsoDateOnly(value);

  return new Date(Date.UTC(dateParts.year, dateParts.monthIndex, dateParts.day, 12, 0, 0));
}

function formatUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${String(year)}-${month}-${day}`;
}

function getTodayIsoDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
