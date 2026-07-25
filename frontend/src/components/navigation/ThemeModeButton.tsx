import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { IconButton, Tooltip } from '@mui/material';

import { useColorMode } from '../../app/theme/colorModeContext';

interface ThemeModeButtonProps {
  color?: 'inherit' | 'default';
}

export function ThemeModeButton({ color = 'default' }: ThemeModeButtonProps) {
  const { mode, toggleColorMode } = useColorMode();
  const isDark = mode === 'dark';
  const label = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  return (
    <Tooltip title={label}>
      <IconButton color={color} onClick={toggleColorMode} aria-label={label}>
        {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
}
