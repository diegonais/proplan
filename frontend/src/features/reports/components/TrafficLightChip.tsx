import { Box, Paper, Stack, Typography } from '@mui/material';

import { getTrafficLightLabel, TrafficLightColor } from '../types';

interface TrafficLightChipProps {
  color: TrafficLightColor;
}

const trafficLights: readonly TrafficLightColor[] = [
  'RED',
  'YELLOW',
  'GREEN',
];

export function TrafficLightChip({ color }: TrafficLightChipProps) {
  return (
    <Stack alignItems="center" spacing={1.5}>
      <Paper
        elevation={0}
        role="img"
        aria-label={`Semaforo del proyecto: ${getTrafficLightLabel(color)}`}
        sx={{
          bgcolor: 'grey.900',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          p: 1.25,
          width: 96,
        }}
      >
        <Stack spacing={1} alignItems="center">
          {trafficLights.map((lightColor) => {
            const isActive = lightColor === color;

            return (
              <Box
                key={lightColor}
                aria-hidden="true"
                sx={(theme) => {
                  const activeColor = resolveLightColor(lightColor, theme.palette.mode);

                  return {
                    bgcolor: isActive ? activeColor : 'grey.700',
                    border: 2,
                    borderColor: isActive ? activeColor : 'grey.800',
                    borderRadius: '50%',
                    boxShadow: isActive ? `0 0 18px ${activeColor}` : 'inset 0 1px 4px rgba(0, 0, 0, 0.45)',
                    height: 48,
                    opacity: isActive ? 1 : 0.38,
                    width: 48,
                  };
                }}
              />
            );
          })}
        </Stack>
      </Paper>
      <Stack alignItems="center" spacing={0.25}>
        <Typography variant="overline" color="text.secondary">
          Semaforo
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {getTrafficLightLabel(color)}
        </Typography>
      </Stack>
    </Stack>
  );
}

function resolveLightColor(color: TrafficLightColor, mode: 'light' | 'dark'): string {
  const colors: Record<TrafficLightColor, { light: string; dark: string }> = {
    GREEN: { light: '#2e7d32', dark: '#66bb6a' },
    YELLOW: { light: '#ed6c02', dark: '#ffb74d' },
    RED: { light: '#d32f2f', dark: '#ef5350' },
  };

  return colors[color][mode];
}
