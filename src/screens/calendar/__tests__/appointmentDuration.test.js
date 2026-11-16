import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  calculateEndAt,
  formatDurationStep,
  getEffectiveDuration,
  getInitialCustomDuration,
  stepDuration,
} from '../appointmentDuration';

describe('getEffectiveDuration', () => {
  it('usa a soma dos servicos quando nao ha ajuste', () => {
    expect(getEffectiveDuration(40, null)).toBe(40);
  });

  it('usa o ajuste quando existe', () => {
    expect(getEffectiveDuration(40, 30)).toBe(30);
  });
});

describe('stepDuration', () => {
  it('encurta a partir do padrao', () => {
    expect(stepDuration({ defaultMinutes: 40, customMinutes: null, step: -10 })).toBe(30);
  });

  it('acumula sobre o ajuste atual', () => {
    expect(stepDuration({ defaultMinutes: 40, customMinutes: 30, step: -5 })).toBe(25);
  });

  it('deixa de ser ajuste ao voltar exatamente ao padrao', () => {
    expect(stepDuration({ defaultMinutes: 40, customMinutes: 30, step: 10 })).toBeNull();
  });

  it('nao desce abaixo do minimo', () => {
    expect(stepDuration({ defaultMinutes: 15, customMinutes: 10, step: -15 })).toBe(MIN_DURATION_MINUTES);
  });

  it('nao passa do teto que a API aceita', () => {
    expect(stepDuration({ defaultMinutes: 60, customMinutes: 715, step: 15 })).toBe(MAX_DURATION_MINUTES);
  });
});

describe('getInitialCustomDuration', () => {
  it('traz o ajuste salvo para a edicao', () => {
    expect(getInitialCustomDuration({ durationMinutes: 30, hasCustomDuration: true })).toBe(30);
  });

  it('ignora a duracao efetiva quando ela e o padrao', () => {
    expect(getInitialCustomDuration({ durationMinutes: 40, hasCustomDuration: false })).toBeNull();
  });

  it('trata agendamento anterior ao ajuste como padrao', () => {
    expect(getInitialCustomDuration({ startAt: '2026-06-01T14:00:00.000Z' })).toBeNull();
  });
});

describe('calculateEndAt', () => {
  it('soma os minutos ao inicio', () => {
    expect(calculateEndAt(new Date('2026-06-01T14:00:00.000Z'), 30))
      .toEqual(new Date('2026-06-01T14:30:00.000Z'));
  });
});

describe('formatDurationStep', () => {
  it('mostra o sinal dos dois lados', () => {
    expect(formatDurationStep(5)).toBe('+5');
    expect(formatDurationStep(-15)).toBe('-15');
  });
});
