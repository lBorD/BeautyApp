import {
  AGENDA_WINDOW_DAYS,
  addLocalDays,
  buildAgendaSections,
  buildAgendaWindow,
  endOfLocalDay,
  getLocalDateKey,
  getNextAgendaWindowBlock,
  getRelativeDayLabel,
  isDayPlaceholder,
  isWithinWindow,
  mergeAppointmentsById,
  selectAgendaSections,
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
  it('nao rotula dias distantes como hoje ou amanha', () => {
    expect(getRelativeDayLabel(atLocalTime(2, 9), TODAY)).toBeNull();
  });
});

describe('recorte do que fica visivel', () => {
  const manyDays = [
    buildAppointment({ id: 1, dayOffset: 0 }),
    buildAppointment({ id: 2, dayOffset: 1 }),
    buildAppointment({ id: 3, dayOffset: 4 }),
    buildAppointment({ id: 4, dayOffset: 7 }),
  ];

  const asList = (sections, limit) => selectAgendaSections(sections, {
    mode: 'lista',
    selectedDateKey: null,
    limit,
  });

  it('corta em 2 secoes no modo lista', () => {
    const visible = asList(sectionsFor(manyDays), 2);

    expect(visible.map((section) => section.key)).toEqual(['2026-08-11', '2026-08-12']);
  });

  it('hoje e sempre a primeira secao, mesmo vazio', () => {
    // Cenario do bug: hoje sem atendimento, proximo em 3 dias.
    const visible = asList(sectionsFor([buildAppointment({ id: 1, dayOffset: 3 })]), 2);

    expect(visible.map((section) => section.key)).toEqual(['2026-08-11', '2026-08-14']);
    expect(isDayPlaceholder(visible[0].data[0])).toBe(true);
  });

  it('pula dias vazios porque eles nao viram secao', () => {
    // Amanha vazio: a segunda vaga vai para o proximo dia COM atendimento.
    const visible = asList(sectionsFor([
      buildAppointment({ id: 1, dayOffset: 0 }),
      buildAppointment({ id: 2, dayOffset: 4 }),
    ]), 2);

    expect(visible.map((section) => section.key)).toEqual(['2026-08-11', '2026-08-15']);
  });

  it('revela mais dias quando o limite cresce', () => {
    const sections = sectionsFor(manyDays);

    expect(asList(sections, 4)).toHaveLength(4);
    expect(asList(sections, 99)).toHaveLength(sections.length);
  });

  it('nunca devolve lista vazia no modo lista', () => {
    expect(asList(sectionsFor(manyDays), 0)).toHaveLength(1);
  });

  it('devolve so a data escolhida no modo dia', () => {
    const visible = selectAgendaSections(sectionsFor(manyDays, atLocalTime(4, 9)), {
      mode: 'dia',
      selectedDateKey: '2026-08-15',
      limit: 2,
    });

    expect(visible).toHaveLength(1);
    expect(visible[0].key).toBe('2026-08-15');
    expect(visible[0].data.map((item) => item.id)).toEqual([3]);
  });

  it('no modo dia, dia sem atendimento vem com placeholder', () => {
    const chosen = atLocalTime(6, 9);
    const visible = selectAgendaSections(sectionsFor(manyDays, chosen), {
      mode: 'dia',
      selectedDateKey: getLocalDateKey(chosen),
      limit: 2,
    });

    expect(visible).toHaveLength(1);
    expect(visible[0].key).toBe('2026-08-17');
    expect(isDayPlaceholder(visible[0].data[0])).toBe(true);
  });

  it('resumo do topo acompanha so o que esta visivel', () => {
    const sections = sectionsFor([
      buildAppointment({ id: 1, dayOffset: 0, price: 100 }),
      buildAppointment({ id: 2, dayOffset: 1, price: 200 }),
      buildAppointment({ id: 3, dayOffset: 5, price: 900 }),
    ]);

    expect(summarizeAgendaSections(asList(sections, 2))).toEqual({
      appointments: 2,
      forecast: 300,
      busyDays: 2,
    });
    expect(summarizeAgendaSections(asList(sections, 99)).forecast).toBe(1200);
  });
});
