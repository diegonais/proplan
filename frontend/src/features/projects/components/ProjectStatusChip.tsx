import { Chip, ChipProps } from '@mui/material';

import { ProjectStatus, getProjectStatusLabel } from '../types';

interface ProjectStatusChipProps {
  status: ProjectStatus;
}

const statusColors: Record<ProjectStatus, ChipProps['color']> = {
  PLANNING: 'info',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

export function ProjectStatusChip({ status }: ProjectStatusChipProps) {
  return (
    <Chip
      label={getProjectStatusLabel(status)}
      color={statusColors[status]}
      size="small"
      variant={status === 'CANCELLED' ? 'outlined' : 'filled'}
    />
  );
}
