import {
  AGENDA_WINDOW_DAYS,
  addLocalDays,
  buildAgendaSections,
  buildAgendaWindow,
  endOfLocalDay,
  findSectionIndexByKey,
  getLocalDateKey,
  getNextAgendaWindowBlock,
  getRelativeDayLabel,
  isDayPlaceholder,
  isWithinWindow,
  mergeAppointmentsById,
  startOfLocalDay,
  summarizeAgendaSections,
} from '../agendaWindow';

const TODAY = new Date(2026, 7, 11, 15, 30);

const atLocalTime = (dayOffset, hour) => {
  const date = addLocalDays(startOfLocalDay(TODAY), dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const buildAppointment = ({ id, dayOffset, hour = 9, status = 'scheduled', price = 100 }) => {
  const startAt = atLocalTime(dayOffset, hour);
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  return { id, startAt: startAt.toISOString(), endAt: endAt.toISOString(), status, price };
};

const sectionsFor = (appointments, focusedDate = null) => {
  const window = buildAgendaWindow(TODAY);
  return buildAgendaSections({
    appointments,
    windowStart: window.start,
    windowEnd: window.end,
    referenceDate: TODAY,
    focusedDate,
  });
};

describe('janela da agenda', () => {
  it('comeca hoje a meia-noite e termina 30 dias depois', () => {
    const window = buildAgendaWindow(TODAY);

    expect(getLocalDateKey(window.start)).toBe('2026-08-11');
    expect(window.start.getHours()).toBe(0);
    expect(window.start.getMinutes()).toBe(0);
    expect(getLocalDateKey(window.end)).toBe('2026-09-10');
    expect(window.end.getHours()).toBe(23);
    expect(window.end.getMilliseconds()).toBe(999);
  });

  it('encadeia o bloco seguinte sem sobreposicao nem buraco', () => {
    const window = buildAgendaWindow(TODAY);
    const maxEnd = endOfLocalDay(addLocalDays(startOfLocalDay(TODAY), 365));
    const block = getNextAgendaWindowBlock(window.end, maxEnd);

    expect(getLocalDateKey(block.start)).toBe('2026-09-11');
    expect(block.start.getHours()).toBe(0);
    expect(getLocalDateKey(block.end)).toBe('2026-10-10');
  });

  it('corta o ultimo bloco no teto de lookahead', () => {
    const window = buildAgendaWindow(TODAY);
    const maxEnd = endOfLocalDay(addLocalDays(startOfLocalDay(TODAY), 35));
    const block = getNextAgendaWindowBlock(window.end, maxEnd);

    expect(getLocalDateKey(block.end)).toBe(getLocalDateKey(maxEnd));
  });

  it('devolve null quando a janela ja alcancou o teto', () => {
    const maxEnd = endOfLocalDay(addLocalDays(startOfLocalDay(TODAY), 30));
    const window = buildAgendaWindow(TODAY);

    expect(getNextAgendaWindowBlock(window.end, maxEnd)).toBeNull();
  });

  it('reconhece datas dentro e fora da janela', () => {
    const window = buildAgendaWindow(TODAY);

    expect(isWithinWindow(atLocalTime(0, 9), window.start, window.end)).toBe(true);
    expect(isWithinWindow(atLocalTime(AGENDA_WINDOW_DAYS, 23), window.start, window.end)).toBe(true);
    expect(isWithinWindow(atLocalTime(-1, 9), window.start, window.end)).toBe(false);
    expect(isWithinWindow(atLocalTime(31, 9), window.start, window.end)).toBe(false);
  });

  it('funde listas por id deixando a resposta mais nova vencer', () => {
    const current = [buildAppointment({ id: 1, dayOffset: 0 })];
    const next = [
      { ...buildAppointment({ id: 1, dayOffset: 0 }), status: 'completed' },
      buildAppointment({ id: 2, dayOffset: 1 }),
    ];

    const merged = mergeAppointmentsById(current, next);

    expect(merged).toHaveLength(2);
    expect(merged[0].status).toBe('completed');
    expect(merged[1].id).toBe(2);
  });
});

describe('secoes da agenda', () => {
  it('nunca pula hoje, mesmo sem nenhum agendamento', () => {
    const sections = sectionsFor([]);

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('2026-08-11');
    expect(sections[0].relativeLabel).toBe('HOJE');
    expect(sections[0].activeCount).toBe(0);
    expect(isDayPlaceholder(sections[0].data[0])).toBe(true);
  });

  it('mostra hoje vazio antes do proximo dia com atendimento', () => {
    // Regressao: o bootstrap pulava hoje e abria direto no proximo atendimento.
    const sections = sectionsFor([buildAppointment({ id: 1, dayOffset: 3 })]);

    expect(sections.map((section) => section.key)).toEqual(['2026-08-11', '2026-08-14']);
    expect(sections[0].activeCount).toBe(0);
    expect(sections[1].activeCount).toBe(1);
  });

  it('rotula hoje e amanha', () => {
    const sections = sectionsFor([
      buildAppointment({ id: 1, dayOffset: 0 }),
      buildAppointment({ id: 2, dayOffset: 1 }),
      buildAppointment({ id: 3, dayOffset: 5 }),
    ]);

    expect(sections.map((section) => section.relativeLabel)).toEqual(['HOJE', 'AMANHÃ', null]);
  });

  it('mantem o dia que so tem cancelado, mas sem contar', () => {
    const sections = sectionsFor([
      buildAppointment({ id: 1, dayOffset: 4, status: 'canceled' }),
    ]);

    const canceledSection = sections.find((section) => section.key === '2026-08-15');
    expect(canceledSection.activeCount).toBe(0);
    expect(canceledSection.forecast).toBe(0);
    expect(canceledSection.data).toHaveLength(1);
    expect(canceledSection.data[0].id).toBe(1);
  });

  it('ordena secoes e itens dentro da secao por horario', () => {
    const sections = sectionsFor([
      buildAppointment({ id: 1, dayOffset: 5, hour: 14 }),
      buildAppointment({ id: 2, dayOffset: 2, hour: 16 }),
      buildAppointment({ id: 3, dayOffset: 2, hour: 8 }),
    ]);

    expect(sections.map((section) => section.key)).toEqual(['2026-08-11', '2026-08-13', '2026-08-16']);
    expect(sections[1].data.map((item) => item.id)).toEqual([3, 2]);
  });

  it('cria secao para o dia escolhido no seletor quando esta na janela', () => {
    const sections = sectionsFor([], atLocalTime(6, 9));

    expect(sections.map((section) => section.key)).toEqual(['2026-08-11', '2026-08-17']);
  });

  it('ignora o dia escolhido quando esta fora da janela', () => {
    const sections = sectionsFor([], atLocalTime(90, 9));

    expect(sections.map((section) => section.key)).toEqual(['2026-08-11']);
  });

  it('descarta agendamentos fora da janela carregada', () => {
    const sections = sectionsFor([
      buildAppointment({ id: 1, dayOffset: 2 }),
      buildAppointment({ id: 2, dayOffset: 60 }),
    ]);

    expect(sections.map((section) => section.key)).toEqual(['2026-08-11', '2026-08-13']);
  });
});

describe('resumo do periodo', () => {
  it('soma so os ativos e conta os dias ocupados', () => {
    const sections = sectionsFor([
      buildAppointment({ id: 1, dayOffset: 0, price: 120 }),
      buildAppointment({ id: 2, dayOffset: 0, hour: 14, price: 80 }),
      buildAppointment({ id: 3, dayOffset: 2, price: 200, status: 'canceled' }),
      buildAppointment({ id: 4, dayOffset: 4, price: 50, status: 'completed' }),
    ]);

    expect(summarizeAgendaSections(sections)).toEqual({
      appointments: 3,
      forecast: 250,
      busyDays: 2,
    });
  });

  it('devolve zeros quando nao ha nada ativo', () => {
    expect(summarizeAgendaSections(sectionsFor([]))).toEqual({
      appointments: 0,
      forecast: 0,
      busyDays: 0,
    });
  });
});

describe('navegacao entre secoes', () => {
  it('acha o indice da secao pelo dia', () => {
    const sections = sectionsFor([
      buildAppointment({ id: 1, dayOffset: 2 }),
      buildAppointment({ id: 2, dayOffset: 5 }),
    ]);

    expect(findSectionIndexByKey(sections, '2026-08-16')).toBe(2);
    expect(findSectionIndexByKey(sections, '2026-08-20')).toBe(-1);
  });

  it('nao rotula dias distantes como hoje ou amanha', () => {
    expect(getRelativeDayLabel(atLocalTime(2, 9), TODAY)).toBeNull();
  });
});
