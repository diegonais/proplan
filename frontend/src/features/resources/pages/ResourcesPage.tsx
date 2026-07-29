import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { useAuth } from '../../auth/authContext';
import { DeleteResourceDialog } from '../components/DeleteResourceDialog';
import { ResourceAvailabilityChip } from '../components/ResourceAvailabilityChip';
import { ResourceAvailabilityDialog } from '../components/ResourceAvailabilityDialog';
import { ResourceFormDialog, ResourceFormValues } from '../components/ResourceFormDialog';
import { ResourceOperationalStatusChip } from '../components/ResourceOperationalStatusChip';
import {
  checkResourceAvailability,
  createResource,
  deleteResource,
  listResources,
  updateResource,
  updateResourceStatus,
} from '../services/resourcesApi';
import {
  PaginatedResourcesResponse,
  Resource,
  ResourceAvailability,
  ResourceCategory,
  ResourceOperationalStatus,
  ResourcePayload,
  getResourceCategoryLabel,
  getResourceOperationalStatusLabel,
  resourceCategories,
  resourceOperationalStatuses,
} from '../types';

const defaultResponse: PaginatedResourcesResponse = {
  data: [],
  meta: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
};

type ActiveFilter = 'true' | 'false' | '';
type AvailabilityByResource = Record<string, ResourceAvailability | undefined>;

export function ResourcesPage() {
  const { user } = useAuth();
  const { showNotification } = useNotifications();
  const [resourcesResponse, setResourcesResponse] =
    useState<PaginatedResourcesResponse>(defaultResponse);
  const [availabilityByResource, setAvailabilityByResource] = useState<AvailabilityByResource>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ResourceCategory | ''>('');
  const [operationalStatus, setOperationalStatus] = useState<ResourceOperationalStatus | ''>('');
  const [isActiveFilter, setIsActiveFilter] = useState<ActiveFilter>('');
  const [availabilityStartDate, setAvailabilityStartDate] = useState('');
  const [availabilityEndDate, setAvailabilityEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [resourceToEdit, setResourceToEdit] = useState<Resource | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null);
  const [resourceForAvailability, setResourceForAvailability] = useState<Resource | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const hasAvailabilityDateRange =
    availabilityStartDate.length > 0 &&
    availabilityEndDate.length > 0 &&
    availabilityEndDate >= availabilityStartDate;
  const hasInvalidAvailabilityRange =
    availabilityStartDate.length > 0 &&
    availabilityEndDate.length > 0 &&
    availabilityEndDate < availabilityStartDate;

  const loadResources = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setResourcesResponse(
        await listResources({
          page: page + 1,
          limit,
          search,
          category: category || undefined,
          operationalStatus: operationalStatus || undefined,
          isActive: parseActiveFilter(isActiveFilter),
          orderBy: 'createdAt',
          order: 'DESC',
        }),
      );
    } catch (requestError: unknown) {
      setResourcesResponse(defaultResponse);
      setError(getApiErrorMessage(requestError).message);
    } finally {
      setIsLoading(false);
    }
  }, [category, isActiveFilter, limit, operationalStatus, page, search]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  useEffect(() => {
    let isMounted = true;

    if (!hasAvailabilityDateRange || resourcesResponse.data.length === 0) {
      setAvailabilityByResource({});
      setIsAvailabilityLoading(false);
      return;
    }

    setIsAvailabilityLoading(true);
    setAvailabilityByResource({});

    void Promise.all(
      resourcesResponse.data.map(async (resource) => {
        try {
          const availability = await checkResourceAvailability(
            resource.uuid,
            availabilityStartDate,
            availabilityEndDate,
          );

          return [resource.uuid, availability] as const;
        } catch {
          return [resource.uuid, undefined] as const;
        }
      }),
    )
      .then((entries) => {
        if (isMounted) {
          setAvailabilityByResource(Object.fromEntries(entries));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAvailabilityLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [availabilityEndDate, availabilityStartDate, hasAvailabilityDateRange, resourcesResponse.data]);

  const hasFilters =
    search.trim().length > 0 ||
    category.length > 0 ||
    operationalStatus.length > 0 ||
    isActiveFilter.length > 0;
  const emptyMessage = hasFilters
    ? 'No se encontraron recursos con los filtros seleccionados.'
    : 'No hay recursos registrados en el catalogo.';
  const selectedResourceName = useMemo(
    () => resourceToDelete?.name ?? 'seleccionado',
    [resourceToDelete],
  );
  const selectedAvailability =
    resourceForAvailability === null || !hasAvailabilityDateRange
      ? null
      : availabilityByResource[resourceForAvailability.uuid];

  const openCreateDialog = () => {
    setFormMode('create');
    setResourceToEdit(null);
    setSubmitError(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (resource: Resource) => {
    setFormMode('edit');
    setResourceToEdit(resource);
    setSubmitError(null);
    setIsFormOpen(true);
  };

  const handleSubmitResource = async (values: ResourceFormValues, payload: ResourcePayload) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (formMode === 'create') {
        await createResource(payload);
        showNotification('Recurso creado correctamente.', 'success');
      } else if (resourceToEdit !== null) {
        await updateResource(resourceToEdit.uuid, payload);

        if (
          values.operationalStatus !== resourceToEdit.operationalStatus ||
          values.isActive !== resourceToEdit.isActive
        ) {
          await updateResourceStatus(resourceToEdit.uuid, {
            operationalStatus:
              values.operationalStatus !== resourceToEdit.operationalStatus
                ? values.operationalStatus
                : undefined,
            isActive: values.isActive !== resourceToEdit.isActive ? values.isActive : undefined,
          });
        }

        showNotification('Recurso actualizado correctamente.', 'success');
      }

      setIsFormOpen(false);
      await loadResources();
    } catch (requestError: unknown) {
      setSubmitError(getApiErrorMessage(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteResource = async () => {
    if (resourceToDelete === null) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteResource(resourceToDelete.uuid);
      showNotification('Recurso eliminado logicamente.', 'success');
      setResourceToDelete(null);
      await loadResources();
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openAvailabilityDialog = (resource: Resource) => {
    if (!hasAvailabilityDateRange) {
      showNotification(
        hasInvalidAvailabilityRange
          ? 'La fecha de fin no puede ser anterior a la fecha de inicio.'
          : 'Seleccione fecha de inicio y fin para consultar disponibilidad.',
        'warning',
      );
      return;
    }

    setResourceForAvailability(resource);
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h1" variant="h1">
            Recursos
          </Typography>
          <Typography color="text.secondary">
            Catalogo institucional de equipos, dispositivos, licencias y servicios disponibles.
          </Typography>
        </Box>
        {isAdmin ? (
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreateDialog}>
            Nuevo recurso
          </Button>
        ) : null}
      </Stack>

      {!isAdmin ? (
        <Alert severity="info">
          Su rol permite consultar el catalogo y la disponibilidad. La modificacion del catalogo
          corresponde a Administrador.
        </Alert>
      ) : null}

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
          <TextField
            label="Buscar"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
          <TextField
            label="Categoria"
            select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as ResourceCategory | '');
              setPage(0);
            }}
          >
            <MenuItem value="">Todas</MenuItem>
            {resourceCategories.map((resourceCategory) => (
              <MenuItem key={resourceCategory} value={resourceCategory}>
                {getResourceCategoryLabel(resourceCategory)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Estado operativo"
            select
            value={operationalStatus}
            onChange={(event) => {
              setOperationalStatus(event.target.value as ResourceOperationalStatus | '');
              setPage(0);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {resourceOperationalStatuses.map((status) => (
              <MenuItem key={status} value={status}>
                {getResourceOperationalStatusLabel(status)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Estado activo"
            select
            value={isActiveFilter}
            onChange={(event) => {
              setIsActiveFilter(event.target.value as ActiveFilter);
              setPage(0);
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="true">Activos</MenuItem>
            <MenuItem value="false">Inactivos</MenuItem>
          </TextField>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Disponibilidad desde"
            type="date"
            value={availabilityStartDate}
            onChange={(event) => {
              setAvailabilityStartDate(event.target.value);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            error={hasInvalidAvailabilityRange}
          />
          <TextField
            label="Disponibilidad hasta"
            type="date"
            value={availabilityEndDate}
            onChange={(event) => {
              setAvailabilityEndDate(event.target.value);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            error={hasInvalidAvailabilityRange}
            helperText={
              hasInvalidAvailabilityRange
                ? 'La fecha de fin no puede ser anterior a la fecha de inicio.'
                : undefined
            }
          />
          <Button
            variant="outlined"
            startIcon={<RefreshOutlinedIcon />}
            onClick={() => {
              void loadResources();
            }}
          >
            Actualizar
          </Button>
        </Stack>
      </Paper>

      {error !== null ? <Alert severity="error">{error}</Alert> : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        {isLoading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress aria-label="Cargando recursos" />
            <Typography color="text.secondary">Cargando recursos</Typography>
          </Stack>
        ) : (
          <Table aria-label="Listado de recursos">
            <TableHead>
              <TableRow>
                <TableCell>Codigo</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Numero de serie</TableCell>
                <TableCell>Estado operativo</TableCell>
                <TableCell>Estado activo</TableCell>
                <TableCell>Disponibilidad</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resourcesResponse.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <Typography color="text.secondary">{emptyMessage}</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                resourcesResponse.data.map((resource) => {
                  const rowAvailability = Object.prototype.hasOwnProperty.call(
                    availabilityByResource,
                    resource.uuid,
                  )
                    ? availabilityByResource[resource.uuid]
                    : null;

                  return (
                    <TableRow key={resource.uuid} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{resource.code}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography sx={{ fontWeight: 700 }}>{resource.name}</Typography>
                        {resource.description !== null ? (
                          <Typography variant="body2" color="text.secondary">
                            {resource.description}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>{getResourceCategoryLabel(resource.category)}</TableCell>
                    <TableCell>{resource.serialNumber ?? 'Sin numero'}</TableCell>
                    <TableCell>
                      <ResourceOperationalStatusChip status={resource.operationalStatus} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={resource.isActive ? 'Activo' : 'Inactivo'}
                        color={resource.isActive ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <ResourceAvailabilityChip
                        availability={rowAvailability}
                        hasDateRange={hasAvailabilityDateRange}
                        isLoading={isAvailabilityLoading}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Consultar disponibilidad">
                        <IconButton
                          aria-label="Consultar disponibilidad"
                          onClick={() => {
                            openAvailabilityDialog(resource);
                          }}
                        >
                          <EventAvailableOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                      {isAdmin ? (
                        <>
                          <Tooltip title="Editar">
                            <IconButton
                              aria-label="Editar"
                              onClick={() => {
                                openEditDialog(resource);
                              }}
                            >
                              <EditOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              color="error"
                              aria-label="Eliminar"
                              onClick={() => {
                                setResourceToDelete(resource);
                              }}
                            >
                              <DeleteOutlineOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
        <TablePagination
          component="div"
          count={resourcesResponse.meta.total}
          page={page}
          rowsPerPage={limit}
          rowsPerPageOptions={[5, 10, 25]}
          labelRowsPerPage="Filas por pagina"
          labelDisplayedRows={({ from, to, count }) =>
            `${String(from)}-${String(to)} de ${String(count)}`
          }
          getItemAriaLabel={(type) => {
            if (type === 'next') {
              return 'Ir a la pagina siguiente';
            }

            if (type === 'previous') {
              return 'Ir a la pagina anterior';
            }

            return type === 'first' ? 'Ir a la primera pagina' : 'Ir a la ultima pagina';
          }}
          onPageChange={(_event, nextPage) => {
            setPage(nextPage);
          }}
          onRowsPerPageChange={(event) => {
            setLimit(Number(event.target.value));
            setPage(0);
          }}
        />
      </TableContainer>

      <ResourceFormDialog
        open={isFormOpen}
        mode={formMode}
        resource={resourceToEdit}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onClose={() => {
          setIsFormOpen(false);
        }}
        onSubmit={handleSubmitResource}
      />

      <DeleteResourceDialog
        open={resourceToDelete !== null}
        resourceName={selectedResourceName}
        isDeleting={isDeleting}
        onCancel={() => {
          setResourceToDelete(null);
        }}
        onConfirm={() => {
          void handleDeleteResource();
        }}
      />

      <ResourceAvailabilityDialog
        open={resourceForAvailability !== null}
        resource={resourceForAvailability}
        startDate={availabilityStartDate}
        endDate={availabilityEndDate}
        availability={selectedAvailability}
        onClose={() => {
          setResourceForAvailability(null);
        }}
      />
    </Stack>
  );
}

function parseActiveFilter(value: ActiveFilter): boolean | undefined {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}
