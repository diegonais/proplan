import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface DeleteProjectDialogProps {
  open: boolean;
  projectName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteProjectDialog({
  open,
  projectName,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps) {
  return (
    <Dialog open={open} onClose={isDeleting ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Eliminar proyecto</DialogTitle>
      <DialogContent>
        <Typography>
          Esta accion eliminara logicamente el proyecto {projectName}. No se realizara eliminacion
          fisica.
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
