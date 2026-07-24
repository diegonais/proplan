import { Chip } from '@mui/material';

import { TaskStatus, getTaskStatusLabel } from '../types';

interface TaskStatusChipProps {
  status: TaskStatus;
}

const statusColor: Record<TaskStatus, 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  PENDING: 'default',
  IN_PROGRESS: 'primary',
  BLOCKED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export function TaskStatusChip({ status }: TaskStatusChipProps) {
  return <Chip label={getTaskStatusLabel(status)} color={statusColor[status]} size="small" />;
}
