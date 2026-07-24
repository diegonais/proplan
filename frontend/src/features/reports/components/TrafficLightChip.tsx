import { Chip } from '@mui/material';

import { getTrafficLightLabel, TrafficLightColor } from '../types';

interface TrafficLightChipProps {
  color: TrafficLightColor;
}

export function TrafficLightChip({ color }: TrafficLightChipProps) {
  return (
    <Chip
      label={getTrafficLightLabel(color)}
      color={resolveChipColor(color)}
      variant={color === 'YELLOW' ? 'outlined' : 'filled'}
      sx={{ fontWeight: 700 }}
    />
  );
}

function resolveChipColor(color: TrafficLightColor): 'success' | 'warning' | 'error' {
  const colors: Record<TrafficLightColor, 'success' | 'warning' | 'error'> = {
    GREEN: 'success',
    YELLOW: 'warning',
    RED: 'error',
  };

  return colors[color];
}
