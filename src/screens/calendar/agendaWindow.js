// Logica pura da Agenda multi-dia: janela deslizante de datas e agrupamento por dia.
// Fica fora do AgendaScreen para poder ser testada sem React Native.

export const AGENDA_WINDOW_DAYS = 30;
export const AGENDA_MAX_LOOKAHEAD_DAYS = 365;

const padDatePart = (value) => String(value).padStart(2, '0');

export const startOfLocalDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const endOfLocalDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

export const addLocalDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

export const getLocalDateKey = (dateValue) => {
  const date = new Date(dateValue);
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
};

export const getMonthKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
};

export const isSameLocalDay = (firstDate, secondDate) => (
  getLocalDateKey(firstDate) === getLocalDateKey(secondDate)
);

export const buildCalendarGridUtcRange = (monthValue) => {
  const month = new Date(monthValue);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const from = new Date(firstDay);
  from.setDate(firstDay.getDate() - firstDay.getDay());
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setDate(from.getDate() + 41);
  to.setHours(23, 59, 59, 999);

  return { from: from.toISOString(), to: to.toISOString() };
};

export const isCanceledAppointment = (appointment) => appointment.status === 'canceled';

export const sortAppointments = (items) => [...items].sort(
  (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
);

export const filterNonCanceledAppointments = (items) => (
  items.filter((item) => !isCanceledAppointment(item))
);

export const buildAgendaWindow = (anchorDate, days = AGENDA_WINDOW_DAYS) => {
  const start = startOfLocalDay(anchorDate);
  const end = endOfLocalDay(addLocalDays(start, days));

  return { start, end, from: start.toISOString(), to: end.toISOString() };
};

// Bloco seguinte, contiguo e sem sobreposicao com o que ja esta carregado.
// Devolve null quando a janela ja alcancou o teto de lookahead.
export const getNextAgendaWindowBlock = (currentEnd, maxEnd, days = AGENDA_WINDOW_DAYS) => {
  const start = startOfLocalDay(addLocalDays(currentEnd, 1));
  const limit = endOfLocalDay(maxEnd);

  if (start.getTime() > limit.getTime()) {
    return null;
  }

  const naturalEnd = endOfLocalDay(addLocalDays(start, days - 1));
  const end = naturalEnd.getTime() > limit.getTime() ? limit : naturalEnd;

  return { start, end, from: start.toISOString(), to: end.toISOString() };
};

export const isWithinWindow = (dateValue, start, end) => {
  const time = new Date(dateValue).getTime();
  return time >= new Date(start).getTime() && time <= new Date(end).getTime();
};

export const mergeAppointmentsById = (current, next) => {
  const merged = [...current];
  const indexById = new Map(current.map((item, index) => [String(item.id), index]));

  next.forEach((item) => {
    const index = indexById.get(String(item.id));

    if (index === undefined) {
      indexById.set(String(item.id), merged.length);
      merged.push(item);
      return;
    }

    // A resposta mais recente vence, para o refresh nao ficar com dado velho.
    merged[index] = item;
  });

  return merged;
};

export const getRelativeDayLabel = (date, referenceDate) => {
  if (isSameLocalDay(date, referenceDate)) {
    return 'HOJE';
  }

  if (isSameLocalDay(date, addLocalDays(referenceDate, 1))) {
    return 'AMANHÃ';
  }

  return null;
};

export const createEmptyDayPlaceholder = (dateKey) => ({ __placeholder: true, dateKey });

export const isDayPlaceholder = (item) => Boolean(item && item.__placeholder);

// Agrupa os agendamentos carregados em secoes de um dia cada.
//
// Vira secao: todo dia com algum agendamento, mais hoje e mais o dia escolhido
// no seletor. Hoje entra sempre para nunca ser pulado, mesmo vazio.
// Cancelados entram na secao (o guardrail exige que continuem restauraveis),
// mas ficam de fora de todos os contadores.
export const buildAgendaSections = ({
  appointments = [],
  windowStart,
  windowEnd,
  referenceDate = new Date(),
  focusedDate = null,
}) => {
  const startKey = getLocalDateKey(windowStart);
  const endKey = getLocalDateKey(windowEnd);
  const buckets = new Map();

  const ensureBucket = (dateValue) => {
    const key = getLocalDateKey(dateValue);

    if (key < startKey || key > endKey) {
      return null;
    }

    if (!buckets.has(key)) {
      buckets.set(key, { key, date: startOfLocalDay(dateValue), items: [] });
    }

    return buckets.get(key);
  };

  ensureBucket(referenceDate);

  if (focusedDate) {
    ensureBucket(focusedDate);
  }

  appointments.forEach((appointment) => {
    const bucket = ensureBucket(appointment.startAt);
    if (bucket) {
      bucket.items.push(appointment);
    }
  });

  return [...buckets.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((bucket) => {
      const data = sortAppointments(bucket.items);
      const active = filterNonCanceledAppointments(data);

      return {
        key: bucket.key,
        date: bucket.date,
        relativeLabel: getRelativeDayLabel(bucket.date, referenceDate),
        activeCount: active.length,
        forecast: active.reduce((total, item) => total + Number(item.price || 0), 0),
        data: data.length > 0 ? data : [createEmptyDayPlaceholder(bucket.key)],
      };
    });
};

export const summarizeAgendaSections = (sections) => sections.reduce((totals, section) => ({
  appointments: totals.appointments + section.activeCount,
  forecast: totals.forecast + section.forecast,
  busyDays: totals.busyDays + (section.activeCount > 0 ? 1 : 0),
}), { appointments: 0, forecast: 0, busyDays: 0 });

export const findSectionIndexByKey = (sections, dateKey) => (
  sections.findIndex((section) => section.key === dateKey)
);
