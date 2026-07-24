import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

interface DeleteTaskDialogProps {
  open: boolean;
  taskName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteTaskDialog({
  open,
  taskName,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteTaskDialogProps) {
  return (
    <Dialog open={open} onClose={isDeleting ? undefined : onCancel}>
      <DialogTitle>Eliminar actividad</DialogTitle>
      <DialogContent>
        <DialogContentText>
          La actividad {taskName} se eliminara logicamente. Si tiene subactividades activas, la
          operacion sera rechazada para evitar eliminaciones en cascada.
        </DialogContentText>
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
