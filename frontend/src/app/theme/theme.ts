import { createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#52525b',
    },
    background: {
      default: '#f6f7f9',
      paper: '#ffffff',
    },
    error: {
      main: '#b91c1c',
    },
    success: {
      main: '#166534',
    },
    warning: {
      main: '#92400e',
    },
    info: {
      main: '#0369a1',
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
        body: {
          minWidth: 320,
        },
        ':focus-visible': {
          outline: '3px solid #f59e0b',
          outlineOffset: 2,
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
