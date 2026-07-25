import { createContext, useContext } from 'react';
import type { PaletteMode } from '@mui/material';

export const colorModeStorageKey = 'proplan.colorMode';

export interface ColorModeContextValue {
  mode: PaletteMode;
  toggleColorMode: () => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

export function useColorMode() {
  const context = useContext(ColorModeContext);

  if (context === undefined) {
    throw new Error('useColorMode debe usarse dentro de ColorModeProvider.');
  }

  return context;
}
