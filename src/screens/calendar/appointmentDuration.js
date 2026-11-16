// Duracao ajustada so naquele atendimento: ela sabe de cabeca quais clientes
// demoram mais ou menos, e o cadastro do servico continua sendo o padrao.
// `null` e o padrao, a soma do estimatedTime dos servicos - o mesmo contrato do
// `durationMinutes` da API.

export const DURATION_STEPS = [-15, -10, -5, 5, 10, 15];
export const MIN_DURATION_MINUTES = 5;
// Mesmo teto que a API aceita.
export const MAX_DURATION_MINUTES = 12 * 60;

export const getEffectiveDuration = (defaultMinutes, customMinutes) => (
  customMinutes ?? defaultMinutes
);

// Voltar exatamente ao padrao pelos passos deixa de ser ajuste, entao o
// "ajustado" some sozinho em vez de mostrar um ajuste igual ao padrao.
export const stepDuration = ({ defaultMinutes, customMinutes, step }) => {
  const current = getEffectiveDuration(defaultMinutes, customMinutes);
  const next = Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, current + step));

  return next === defaultMinutes ? null : next;
};

// Agendamento salvo antes da API conhecer a duracao ajustada nao traz
// `hasCustomDuration` e e tratado como padrao.
export const getInitialCustomDuration = (appointment) => (
  appointment?.hasCustomDuration ? Number(appointment.durationMinutes) : null
);

export const calculateEndAt = (startAt, minutes) => (
  new Date(startAt.getTime() + minutes * 60 * 1000)
);

export const formatDurationStep = (step) => (step > 0 ? `+${step}` : `${step}`);
