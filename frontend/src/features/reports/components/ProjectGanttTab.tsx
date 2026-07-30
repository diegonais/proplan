import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import { useNotifications } from '../../../components/feedback/notificationsContext';
import { getApiErrorMessage } from '../../../services/http/apiError';
import { Project } from '../../projects/types';
import {
  downloadProjectExcelExport,
  downloadProjectPdfExport,
  getProjectGanttReport,
  ProjectExportDownload,
} from '../services/reportsApi';
import { GanttReport } from '../types';
import { GanttChart } from './GanttChart';

interface ProjectGanttTabProps {
  project: Project;
}

export function ProjectGanttTab({ project }: ProjectGanttTabProps) {
  const [report, setReport] = useState<GanttReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showNotification } = useNotifications();

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await getProjectGanttReport(project.uuid));
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError).message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [project.uuid]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleDownload = async (format: 'pdf' | 'excel') => {
    setDownloadingFormat(format);
    try {
      const file =
        format === 'pdf'
          ? await downloadProjectPdfExport(project.uuid, 'gantt')
          : await downloadProjectExcelExport(project.uuid, 'gantt');
      triggerBrowserDownload(file);
      showNotification('Exportacion generada correctamente.', 'success');
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      const file = await downloadProjectPdfExport(project.uuid, 'gantt');
      if (!openPdfPreview(file)) {
        showNotification('Permita ventanas emergentes para previsualizar el PDF.', 'warning');
      }
    } catch (requestError: unknown) {
      showNotification(getApiErrorMessage(requestError).message, 'error');
    } finally {
      setIsPreviewing(false);
    }
  };

  if (isLoading) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
        <CircularProgress aria-label="Cargando diagrama de Gantt" />
        <Typography color="text.secondary">Cargando Gantt</Typography>
      </Stack>
    );
  }

  if (error !== null || report === null) {
    return <Alert severity="error">{error ?? 'No se pudo cargar el Gantt.'}</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography component="h2" variant="h5">
            Diagrama de Gantt
          </Typography>
          <Typography color="text.secondary">{report.datePolicy}</Typography>
        </Box>
        <ExportButtons
          downloadingFormat={downloadingFormat}
          isPreviewing={isPreviewing}
          onPreview={() => {
            void handlePreview();
          }}
          onDownload={(format) => {
            void handleDownload(format);
          }}
        />
      </Stack>
      <GanttChart report={report} />
    </Stack>
  );
}

function ExportButtons({
  downloadingFormat,
  isPreviewing,
  onPreview,
  onDownload,
}: {
  downloadingFormat: 'pdf' | 'excel' | null;
  isPreviewing: boolean;
  onPreview: () => void;
  onDownload: (format: 'pdf' | 'excel') => void;
}) {
  const isBusy = downloadingFormat !== null || isPreviewing;

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
      <Button
        variant="outlined"
        startIcon={
          isPreviewing ? (
            <CircularProgress size={18} aria-label="Generando previsualizacion" />
          ) : (
            <VisibilityOutlinedIcon />
          )
        }
        disabled={isBusy}
        onClick={onPreview}
      >
        Previsualizar
      </Button>
      <Button
        variant="outlined"
        startIcon={
          downloadingFormat === 'pdf' ? (
            <CircularProgress size={18} aria-label="Descargando PDF" />
          ) : (
            <PictureAsPdfOutlinedIcon />
          )
        }
        disabled={isBusy}
        onClick={() => {
          onDownload('pdf');
        }}
      >
        Exportar PDF
      </Button>
      <Button
        variant="outlined"
        startIcon={
          downloadingFormat === 'excel' ? (
            <CircularProgress size={18} aria-label="Descargando Excel" />
          ) : (
            <TableChartOutlinedIcon />
          )
        }
        disabled={isBusy}
        onClick={() => {
          onDownload('excel');
        }}
      >
        Exportar Excel
      </Button>
    </Stack>
  );
}

function openPdfPreview(file: ProjectExportDownload): boolean {
  const objectUrl = URL.createObjectURL(file.blob);
  const previewWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');

  if (previewWindow === null) {
    URL.revokeObjectURL(objectUrl);
    return false;
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60000);

  return true;
}

function triggerBrowserDownload(file: ProjectExportDownload): void {
  const objectUrl = URL.createObjectURL(file.blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = file.fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
