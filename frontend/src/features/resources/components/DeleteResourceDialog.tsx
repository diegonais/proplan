import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface DeleteResourceDialogProps {
  open: boolean;
  resourceName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteResourceDialog({
  open,
  resourceName,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteResourceDialogProps) {
  return (
    <Dialog open={open} onClose={isDeleting ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Eliminar recurso</DialogTitle>
      <DialogContent>
        <Typography>
          Esta accion eliminara logicamente el recurso {resourceName}. El historial de asignaciones
          se conservara.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting}>
          Cancelar
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={isDeleting}>
          Eliminar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
