import {
  APPOINTMENT_ACTIONS,
  getAppointmentActionKeys,
  getAppointmentActions,
} from '../appointmentActions';

describe('acoes por status do atendimento', () => {
  it('agendado permite editar, concluir e cancelar', () => {
    expect(getAppointmentActionKeys('scheduled')).toEqual(['edit', 'complete', 'cancel']);
  });

  it('concluido permite voltar para agendado', () => {
    // Regressao: antes so `scheduled` mostrava a acao de concluir e nao havia
    // caminho de volta, entao marcar concluido por engano era irreversivel.
    expect(getAppointmentActionKeys('completed')).toContain('reschedule');
    expect(APPOINTMENT_ACTIONS.reschedule.label).toBe('Voltar para agendado');
  });

  it('concluido nao oferece concluir de novo', () => {
    expect(getAppointmentActionKeys('completed')).not.toContain('complete');
  });

  it('cancelado permite restaurar e apagar, e nada mais', () => {
    expect(getAppointmentActionKeys('canceled')).toEqual(['restore', 'archive']);
  });

  it('cancelado nao permite editar nem concluir', () => {
    const keys = getAppointmentActionKeys('canceled');
    expect(keys).not.toContain('edit');
    expect(keys).not.toContain('complete');
  });

  it('status desconhecido nao quebra a tela', () => {
    expect(getAppointmentActionKeys(undefined)).toEqual([]);
    expect(getAppointmentActions('qualquer-coisa')).toEqual([]);
  });

  it('toda acao tem rotulo, icone e tom definidos', () => {
    ['scheduled', 'completed', 'canceled'].forEach((status) => {
      getAppointmentActions(status).forEach((action) => {
        expect(Boolean(action.label)).toBe(true);
        expect(Boolean(action.icon)).toBe(true);
        expect(['primary', 'success', 'destructive']).toContain(action.tone);
      });
    });
  });

  it('so apagar e cancelar sao destrutivos', () => {
    const destructive = Object.values(APPOINTMENT_ACTIONS)
      .filter((action) => action.tone === 'destructive')
      .map((action) => action.key)
      .sort();

    expect(destructive).toEqual(['archive', 'cancel']);
  });
});
