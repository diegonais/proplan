import { Chip, ChipProps } from '@mui/material';

import { ResourceOperationalStatus, getResourceOperationalStatusLabel } from '../types';

interface ResourceOperationalStatusChipProps {
  status: ResourceOperationalStatus;
}

const statusColors: Record<ResourceOperationalStatus, ChipProps['color']> = {
  OPERATIONAL: 'success',
  MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'error',
};

export function ResourceOperationalStatusChip({ status }: ResourceOperationalStatusChipProps) {
  return (
    <Chip
      label={getResourceOperationalStatusLabel(status)}
      color={statusColors[status]}
      size="small"
      variant={status === 'OPERATIONAL' ? 'filled' : 'outlined'}
    />
  );
}
