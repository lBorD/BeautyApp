// Fonte unica das acoes disponiveis por status.
//
// O popover do "..." e o modal de detalhes derivam desta lista, para que nunca
// discordem entre si. Foi justamente a divergencia que deixou "Voltar para
// agendado" de fora: a acao de concluir so aparecia para `scheduled` e nao
// existia caminho de volta a partir de `completed`.

export const APPOINTMENT_ACTIONS = {
  edit: {
    key: 'edit',
    label: 'Editar agendamento',
    icon: 'create-outline',
    tone: 'primary',
  },
  complete: {
    key: 'complete',
    label: 'Atendimento concluído',
    icon: 'checkmark-circle-outline',
    tone: 'success',
  },
  reschedule: {
    key: 'reschedule',
    label: 'Voltar para agendado',
    icon: 'arrow-undo-outline',
    tone: 'primary',
  },
  cancel: {
    key: 'cancel',
    label: 'Cancelar atendimento',
    icon: 'close-circle-outline',
    tone: 'destructive',
  },
  restore: {
    key: 'restore',
    label: 'Restaurar atendimento',
    icon: 'arrow-undo-outline',
    tone: 'primary',
  },
  archive: {
    key: 'archive',
    label: 'Apagar da agenda',
    icon: 'trash-outline',
    tone: 'destructive',
  },
};

const ACTIONS_BY_STATUS = {
  scheduled: ['edit', 'complete', 'cancel'],
  completed: ['edit', 'reschedule', 'cancel'],
  canceled: ['restore', 'archive'],
};

export const getAppointmentActionKeys = (status) => ACTIONS_BY_STATUS[status] || [];

export const getAppointmentActions = (status) => (
  getAppointmentActionKeys(status).map((key) => APPOINTMENT_ACTIONS[key])
);
