import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';

import { canAccessNavigationItem, navigationItems } from '../components/navigation/navigationItems';
import { useAuth } from '../features/auth/authContext';
import { getRoleLabel } from '../features/auth/types';

const drawerWidth = 280;
const drawerWidthPx = '280px';

export function AuthenticatedLayout() {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const { logout, user } = useAuth();

  const authorizedItems =
    user === null
      ? []
      : navigationItems.filter((item) => canAccessNavigationItem(item, user.role));

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CheckCircleOutlineIcon color="primary" aria-hidden="true" />
          <Typography component="p" variant="h6" sx={{ fontWeight: 700 }}>
            PROPLAN
          </Typography>
        </Stack>
      </Toolbar>
      <Divider />
      <List component="nav" aria-label="Navegación principal" sx={{ px: 1, py: 1.5 }}>
        {authorizedItems.map((item) => {
          const isSelected =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

          return (
            <ListItem disablePadding key={item.path} sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={isSelected}
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                }}
                sx={{ borderRadius: 1 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      {user !== null ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {user.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getRoleLabel(user.role)}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="primary"
        sx={{
          width: { md: `calc(100% - ${drawerWidthPx})` },
          ml: { md: drawerWidthPx },
        }}
      >
        <Toolbar>
          {!isDesktop ? (
            <Tooltip title="Abrir navegación">
              <IconButton
                color="inherit"
                edge="start"
                onClick={() => {
                  setIsMobileDrawerOpen(true);
                }}
                aria-label="Abrir navegación"
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>
          ) : null}
          <Typography component="p" variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Sistema de gestión y planificación
          </Typography>
          <Tooltip title="Cerrar sesión">
            <IconButton
              color="inherit"
              onClick={() => {
                logout();
              }}
              aria-label="Cerrar sesión"
            >
              <LogoutOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" aria-label="Menú lateral">
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop || isMobileDrawerOpen}
          onClose={() => {
            setIsMobileDrawerOpen(false);
          }}
          ModalProps={{ keepMounted: true }}
          sx={{
            width: { md: drawerWidth },
            flexShrink: { md: 0 },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidthPx})` },
          minHeight: '100vh',
          px: { xs: 2, sm: 3 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
