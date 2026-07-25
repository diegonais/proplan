import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
  palette: {
    mode,
    primary: {
      main: isDark ? '#90caf9' : '#1d4ed8',
      contrastText: isDark ? '#111827' : '#ffffff',
    },
    secondary: {
      main: isDark ? '#d4d4d8' : '#52525b',
    },
    background: {
      default: isDark ? '#121212' : '#f6f7f9',
      paper: isDark ? '#1e1e1e' : '#ffffff',
    },
    text: {
      primary: isDark ? '#f4f4f5' : '#18181b',
      secondary: isDark ? '#c7c7cc' : '#52525b',
    },
    divider: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(24, 24, 27, 0.12)',
    action: {
      hover: isDark ? 'rgba(144, 202, 249, 0.12)' : 'rgba(29, 78, 216, 0.08)',
      selected: isDark ? 'rgba(144, 202, 249, 0.18)' : 'rgba(29, 78, 216, 0.12)',
      disabledBackground: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(24, 24, 27, 0.12)',
    },
    error: {
      main: isDark ? '#fca5a5' : '#b91c1c',
    },
    success: {
      main: isDark ? '#86efac' : '#166534',
    },
    warning: {
      main: isDark ? '#fcd34d' : '#92400e',
    },
    info: {
      main: isDark ? '#7dd3fc' : '#0369a1',
    },
  },
  typography: {
    fontFamily: ['Roboto', 'Arial', 'sans-serif'].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 700,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 700,
    },
    allVariants: {
      letterSpacing: 0,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
        },
      },
    },
    MuiContainer: {
      defaultProps: {
        maxWidth: 'lg',
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          colorScheme: mode,
        },
        body: {
          minWidth: 320,
        },
        ':focus-visible': {
          outline: `3px solid ${isDark ? '#fbbf24' : '#f59e0b'}`,
          outlineOffset: 2,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        fullWidth: true,
        variant: 'outlined',
      },
    },
  },
  });
}
