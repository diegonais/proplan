import { CssBaseline, ThemeProvider } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { useMemo, useState } from 'react';

import {
  ColorModeContext,
  colorModeStorageKey,
  type ColorModeContextValue,
} from './colorModeContext';
import { createAppTheme } from './theme';

interface ColorModeProviderProps {
  children: React.ReactNode;
}

function getInitialColorMode(): PaletteMode {
  const storedMode = window.localStorage.getItem(colorModeStorageKey);

  if (storedMode === 'light' || storedMode === 'dark') {
    return storedMode;
  }

  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

export function ColorModeProvider({ children }: ColorModeProviderProps) {
  const [mode, setMode] = useState<PaletteMode>(getInitialColorMode);

  const contextValue = useMemo<ColorModeContextValue>(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((currentMode) => {
          const nextMode = currentMode === 'light' ? 'dark' : 'light';
          window.localStorage.setItem(colorModeStorageKey, nextMode);
          return nextMode;
        });
      },
    }),
    [mode],
  );

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
