import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  BackHandler,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from '../../components/DateTimePickerModal';
import colors from '../../constants/colors';
import useCurrencyInput from '../../hooks/useCurrencyInput';
import {
  calculateDepositAmount,
  calculateRemainingAmount,
  formatCurrency,
  inferDepositPercent,
  isSameCurrencyAmount,
  roundCurrency,
} from '../../utils/currency';
import {
  AGENDA_MAX_LOOKAHEAD_DAYS,
  AGENDA_WINDOW_DAYS,
  addLocalDays,
  buildAgendaSections,
  buildAgendaWindow,
  buildCalendarGridUtcRange,
  endOfLocalDay,
  findSectionIndexByKey,
  getLocalDateKey,
  getMonthKey,
  getNextAgendaWindowBlock,
  isCanceledAppointment,
  isDayPlaceholder,
  isWithinWindow,
  mergeAppointmentsById,
  sortAppointments,
  startOfLocalDay,
  summarizeAgendaSections,
} from './agendaWindow';
import api from '../../services/api';
import { isSessionExpiredError } from '../../services/sessionManager';
import {
  createAppointment,
  listAppointments,
  updateAppointment,
  updateAppointmentStatus,
} from '../../services/private/appointmentAPI';

const DAY_START_HOUR = 8;
const CLIENT_SEARCH_LIMIT = 30;
const DEFAULT_DEPOSIT_PERCENT = 0;
const DEPOSIT_PERCENT_OPTIONS = [0, 15, 30];
const AGENDA_END_REACHED_THRESHOLD = 0.4;
const ACTION_ANIMATION_DURATION = 180;
const ACTION_POPOVER_MAX_WIDTH = 268;
const ACTION_POPOVER_ESTIMATED_HEIGHT = 210;
const ACTION_POPOVER_SCREEN_MARGIN = 16;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const statusLabels = {
  scheduled: 'Agendado',
  canceled: 'Cancelado',
  completed: 'Concluído',
};

const statusColors = {
  scheduled: '#1677ff',
  canceled: colors.error,
  completed: colors.success,
};

const googleSyncLabels = {
  pending: 'Google pendente',
  synced: 'Google sincronizado',
  failed: 'Falha no Google',
};

const googleSyncColors = {
  pending: colors.warning,
  synced: colors.success,
  failed: colors.error,
};

const getAppointmentServices = (appointment) => {
  if (Array.isArray(appointment.services) && appointment.services.length > 0) {
    return appointment.services;
  }

  if (!appointment.serviceId) {
    return [];
  }

  const durationMinutes = appointment.startAt && appointment.endAt
    ? Math.max(
      0,
      Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60000),
    )
    : 0;

  return [{
    id: appointment.serviceId,
    serviceId: appointment.serviceId,
    name: appointment.serviceName,
    serviceName: appointment.serviceName,
    price: appointment.price,
    estimatedTime: durationMinutes,
  }];
};

const getAppointmentServiceIds = (appointment) => {
  if (Array.isArray(appointment.serviceIds) && appointment.serviceIds.length > 0) {
    return appointment.serviceIds;
  }

  return getAppointmentServices(appointment)
    .map((service) => service.serviceId || service.id)
    .filter(Boolean);
};

const getAppointmentServiceName = (appointment) => {
  if (appointment.serviceName) {
    return appointment.serviceName;
  }

  return getAppointmentServices(appointment)
    .map((service) => service.serviceName || service.name)
    .filter(Boolean)
    .join(' + ');
};

const calculateServicesTotal = (services) => services.reduce((totals, service) => ({
  price: totals.price + Number(service.price || 0),
  estimatedTime: totals.estimatedTime + Number(service.estimatedTime || 0),
}), { price: 0, estimatedTime: 0 });

const formatDateLabel = (date) => date.toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});

// "quinta-feira, 13 de agosto" fica longo demais no cabecalho da secao.
const formatSectionDate = (date) => formatDateLabel(date).replace('-feira', '');

const formatShortDate = (date) => date.toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const formatTime = (value) => new Date(value).toLocaleTimeString('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

const getAppointmentErrorMessage = (error, fallback) => (
  error?.response?.data?.error
  || error?.response?.data?.message
  || fallback
);

const isAppointmentConflictError = (error) => error?.response?.status === 409;

const hasTimeOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

const AgendaScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const bottomInset = Math.max(insets.bottom, 8);
  const screenRef = useRef(null);
  const actionButtonRefs = useRef({});
  const sectionListRef = useRef(null);
  const sectionsRef = useRef([]);
  const scrollTargetRef = useRef(null);
  const canLoadMoreRef = useRef(false);
  // "Hoje" fica congelado na montagem para os rotulos nao mudarem sozinhos
  // se o app ficar aberto durante a virada do dia.
  const todayRef = useRef(startOfLocalDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()));
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarMarksByMonth, setCalendarMarksByMonth] = useState({});
  const calendarMarksCacheRef = useRef({});
  const calendarCacheGenerationRef = useRef(0);
  const calendarRequestIdsRef = useRef({});

  const [agendaWindow, setAgendaWindow] = useState(() => {
    const window = buildAgendaWindow(startOfLocalDay(new Date()));
    return { start: window.start, end: window.end };
  });
  // Espelha a janela para os handlers assincronos nao lerem closure velha.
  const windowRangeRef = useRef(agendaWindow);
  const [loadMoreState, setLoadMoreState] = useState('idle');
  const [scrollRequestId, setScrollRequestId] = useState(0);

  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [hasClientRecords, setHasClientRecords] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [selectedClientOption, setSelectedClientOption] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);
  const [actionPopoverPosition, setActionPopoverPosition] = useState(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState(null);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState(null);
  const [statusAnimationAppointmentId, setStatusAnimationAppointmentId] = useState(null);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const actionMenuAnimation = useRef(new Animated.Value(0)).current;
  const statusChangeAnimation = useRef(new Animated.Value(1)).current;

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [startPickerMode, setStartPickerMode] = useState('date');
  const [conflictConfirmationVisible, setConflictConfirmationVisible] = useState(false);

  const [form, setForm] = useState({
    clientId: null,
    serviceIds: [],
    startAt: new Date(),
    depositPercent: DEFAULT_DEPOSIT_PERCENT,
    depositAmount: 0,
    depositMode: 'percent',
    notes: '',
  });
  // Forca o campo de sinal a redesenhar quando o valor externo nao muda de numero
  // mas o texto precisa voltar ao normalizado (chip 0% com campo zerado, reabrir o modal).
  const [depositSyncToken, setDepositSyncToken] = useState(0);

  const canSchedule = hasClientRecords && services.length > 0;
  const markedDates = calendarMarksByMonth[getMonthKey(visibleCalendarMonth)] || [];

  const animateNextLayout = useCallback(() => {
    if (reduceMotionEnabled) {
      return;
    }

    LayoutAnimation.configureNext({
      duration: ACTION_ANIMATION_DURATION,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  }, [reduceMotionEnabled]);

  const closeAppointmentActions = useCallback(() => {
    actionMenuAnimation.stopAnimation();
    actionMenuAnimation.setValue(0);
    setExpandedAppointmentId(null);
    setActionPopoverPosition(null);
    setDeleteConfirmationId(null);
  }, [actionMenuAnimation]);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (mounted) {
        setReduceMotionEnabled(isEnabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotionEnabled);

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (expandedAppointmentId === null) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeAppointmentActions();
      return true;
    });

    return () => subscription.remove();
  }, [closeAppointmentActions, expandedAppointmentId]);

  const selectedServices = useMemo(
    () => form.serviceIds
      .map((serviceId) => services.find((item) => Number(item.id) === Number(serviceId)))
      .filter(Boolean),
    [services, form.serviceIds],
  );

  const searchedServiceOptions = useMemo(() => {
    const normalizedSearch = serviceSearch.trim().toLowerCase();
    return normalizedSearch
      ? services.filter((service) => service.name?.toLowerCase().includes(normalizedSearch))
      : [];
  }, [serviceSearch, services]);

  const serviceOptions = useMemo(() => {
    const selectedNotInResults = selectedServices.filter((selectedService) => (
      !searchedServiceOptions.some((service) => Number(service.id) === Number(selectedService.id))
    ));

    return [...selectedNotInResults, ...searchedServiceOptions];
  }, [searchedServiceOptions, selectedServices]);

  const selectedServicesTotal = useMemo(
    () => calculateServicesTotal(selectedServices),
    [selectedServices],
  );

  const selectedDepositAmount = useMemo(
    () => roundCurrency(Number(form.depositAmount || 0)),
    [form.depositAmount],
  );

  const selectedRemainingAmount = useMemo(
    () => calculateRemainingAmount(selectedServicesTotal.price, selectedDepositAmount),
    [selectedDepositAmount, selectedServicesTotal.price],
  );

  const applyClientOptions = (nextClients) => {
    setClients((previousClients) => {
      const selected = selectedClientOption && Number(selectedClientOption.id) === Number(form.clientId)
        ? selectedClientOption
        : previousClients.find((item) => Number(item.id) === Number(form.clientId));

      if (selected && !nextClients.some((item) => Number(item.id) === Number(selected.id))) {
        return [selected, ...nextClients];
      }

      return nextClients;
    });
  };

  const activeAppointments = useMemo(
    () => appointments.filter((item) => !isCanceledAppointment(item)),
    [appointments],
  );

  const sections = useMemo(() => buildAgendaSections({
    appointments,
    windowStart: agendaWindow.start,
    windowEnd: agendaWindow.end,
    referenceDate: todayRef.current,
    focusedDate: selectedDate,
  }), [appointments, agendaWindow, selectedDate]);

  const windowSummary = useMemo(() => summarizeAgendaSections(sections), [sections]);

  // O retry de scroll roda dentro de setTimeout, entao precisa das secoes por ref.
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const isWindowShowingToday = isWithinWindow(
    todayRef.current,
    agendaWindow.start,
    agendaWindow.end,
  );

  const loadClientAvailability = async () => {
    try {
      const response = await api.get('/clients/search', {
        params: { page: 1, limit: 1 },
      });

      const hasRecords = Number(response.data.total || 0) > 0;
      setHasClientRecords(hasRecords);
      return hasRecords;
    } catch (error) {
      console.error('Erro ao verificar clientes:', error.response?.data || error.message);
      if (!isSessionExpiredError(error)) {
        setHasClientRecords(false);
      }
      return false;
    }
  };

  const loadClientOptions = async (search = '') => {
    const normalizedSearch = search.trim();

    if (!normalizedSearch) {
      setClients(selectedClientOption ? [selectedClientOption] : []);
      setClientSearchLoading(false);
      return selectedClientOption ? [selectedClientOption] : [];
    }

    setClientSearchLoading(true);

    try {
      const response = await api.get('/clients/search', {
        params: {
          page: 1,
          limit: CLIENT_SEARCH_LIMIT,
          search: normalizedSearch,
        },
      });

      const nextClients = response.data.clients || [];
      applyClientOptions(nextClients);

      if (nextClients.length > 0) {
        setHasClientRecords(true);
      }

      return nextClients;
    } catch (error) {
      console.error('Erro ao buscar clientes:', error.response?.data || error.message);
      if (!isSessionExpiredError(error)) {
        setClients([]);
      }
      return [];
    } finally {
      setClientSearchLoading(false);
    }
  };

  const loadClientsAndServices = async () => {
    const [, servicesResponse] = await Promise.all([
      loadClientAvailability(),
      api.get('/services/search/active'),
    ]);

    setClients([]);
    setSelectedClientOption(null);
    setServices(servicesResponse.data || []);
  };

  const applyWindowRange = (start, end) => {
    windowRangeRef.current = { start, end };
    setAgendaWindow({ start, end });
  };

  // Recarrega a janela inteira ancorada em uma data. Usado no bootstrap, no
  // refresh e quando o seletor pede um dia longe do que esta carregado.
  const loadAgendaWindow = async (anchorDate, { isRefresh = false, keepRange = false } = {}) => {
    if (!isRefresh) {
      setLoading(true);
    }

    try {
      const range = keepRange
        ? {
          start: windowRangeRef.current.start,
          end: windowRangeRef.current.end,
          from: windowRangeRef.current.start.toISOString(),
          to: windowRangeRef.current.end.toISOString(),
        }
        : buildAgendaWindow(anchorDate);

      const data = await listAppointments({ from: range.from, to: range.to });
      applyWindowRange(range.start, range.end);
      setAppointments(sortAppointments(data));
      setLoadMoreState('idle');
    } catch (error) {
      console.error('Erro ao carregar agenda:', error.response?.data || error.message);
      if (!isSessionExpiredError(error)) {
        Alert.alert('Erro', 'Não foi possível carregar a agenda.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getMaxAgendaEnd = () => endOfLocalDay(
    addLocalDays(todayRef.current, AGENDA_MAX_LOOKAHEAD_DAYS),
  );

  // Anexa blocos contiguos ate cobrir `desiredEnd`, sem recarregar o que ja veio.
  const extendAgendaWindowTo = async (desiredEnd) => {
    const maxEnd = getMaxAgendaEnd();
    const limit = desiredEnd.getTime() > maxEnd.getTime() ? maxEnd : desiredEnd;

    if (windowRangeRef.current.end.getTime() >= limit.getTime()) {
      setLoadMoreState(
        windowRangeRef.current.end.getTime() >= maxEnd.getTime() ? 'exhausted' : 'idle',
      );
      return;
    }

    setLoadMoreState('loading');

    try {
      let cursor = windowRangeRef.current.end;

      while (cursor.getTime() < limit.getTime()) {
        const block = getNextAgendaWindowBlock(cursor, limit);
        if (!block) break;

        // eslint-disable-next-line no-await-in-loop
        const data = await listAppointments({ from: block.from, to: block.to });
        setAppointments((previous) => sortAppointments(mergeAppointmentsById(previous, data)));
        applyWindowRange(windowRangeRef.current.start, block.end);
        cursor = block.end;
      }

      setLoadMoreState(
        windowRangeRef.current.end.getTime() >= maxEnd.getTime() ? 'exhausted' : 'idle',
      );
    } catch (error) {
      console.error('Erro ao carregar mais dias:', error.response?.data || error.message);
      setLoadMoreState('error');
    }
  };

  const extendAgendaWindow = () => extendAgendaWindowTo(
    endOfLocalDay(addLocalDays(windowRangeRef.current.end, AGENDA_WINDOW_DAYS)),
  );

  // Garante que a data esteja na janela: estende quando esta logo adiante,
  // reancora quando esta no passado ou muito longe.
  const ensureDateVisible = async (date) => {
    const target = startOfLocalDay(date);
    const { start, end } = windowRangeRef.current;

    if (isWithinWindow(target, start, end)) {
      return;
    }

    const oneBlockAhead = endOfLocalDay(addLocalDays(end, AGENDA_WINDOW_DAYS));

    if (target.getTime() > end.getTime() && target.getTime() <= oneBlockAhead.getTime()) {
      await extendAgendaWindowTo(endOfLocalDay(addLocalDays(target, AGENDA_WINDOW_DAYS)));
      return;
    }

    await loadAgendaWindow(target);
  };

  const isWithinLoadedWindow = (dateValue) => isWithinWindow(
    dateValue,
    windowRangeRef.current.start,
    windowRangeRef.current.end,
  );

  const loadCalendarMarks = useCallback(async (monthValue, { force = false } = {}) => {
    const normalizedMonth = new Date(
      monthValue.getFullYear(),
      monthValue.getMonth(),
      1,
    );
    const monthKey = getMonthKey(normalizedMonth);
    const cachedMarks = calendarMarksCacheRef.current[monthKey];

    if (!force && cachedMarks) {
      setCalendarMarksByMonth((previous) => ({ ...previous, [monthKey]: cachedMarks }));
      return cachedMarks;
    }

    const requestGeneration = calendarCacheGenerationRef.current;
    const requestId = (calendarRequestIdsRef.current[monthKey] || 0) + 1;
    calendarRequestIdsRef.current[monthKey] = requestId;

    try {
      const { from, to } = buildCalendarGridUtcRange(normalizedMonth);
      const data = await listAppointments({ from, to });
      const nextMarks = [...new Set(
        data
          .filter((appointment) => ['scheduled', 'completed'].includes(appointment.status))
          .map((appointment) => getLocalDateKey(appointment.startAt)),
      )].sort();

      if (
        calendarCacheGenerationRef.current !== requestGeneration
        || calendarRequestIdsRef.current[monthKey] !== requestId
      ) {
        return calendarMarksCacheRef.current[monthKey] || [];
      }

      calendarMarksCacheRef.current[monthKey] = nextMarks;
      setCalendarMarksByMonth((previous) => ({ ...previous, [monthKey]: nextMarks }));
      return nextMarks;
    } catch (error) {
      console.error('Erro ao carregar marcadores da agenda:', error.response?.data || error.message);
      return cachedMarks || [];
    }
  }, []);

  const refreshCalendarMarksForDates = useCallback(async (dateValues) => {
    if (dateValues.filter(Boolean).length === 0) {
      return;
    }

    // A grade de 42 dias inclui datas dos meses vizinhos. Limpar o cache inteiro
    // evita deixar um marcador de borda desatualizado após mover ou excluir.
    calendarCacheGenerationRef.current += 1;
    calendarMarksCacheRef.current = {};
    setCalendarMarksByMonth({});
    await loadCalendarMarks(visibleCalendarMonth, { force: true });
  }, [loadCalendarMarks, visibleCalendarMonth]);

  const handleVisibleMonthChange = useCallback((nextMonth) => {
    const normalizedMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    setVisibleCalendarMonth(normalizedMonth);
    loadCalendarMarks(normalizedMonth);
  }, [loadCalendarMarks]);

  const openDayPicker = () => {
    const nextMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    setVisibleCalendarMonth(nextMonth);
    setShowDayPicker(true);
    loadCalendarMarks(nextMonth);
  };

  const requestScrollToDate = (date) => {
    scrollTargetRef.current = { key: getLocalDateKey(date), attempts: 0 };
    setScrollRequestId((id) => id + 1);
  };

  const focusDate = async (date) => {
    const target = startOfLocalDay(date);
    closeAppointmentActions();
    setSelectedDate(target);
    setVisibleCalendarMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    await ensureDateVisible(target);
    requestScrollToDate(target);
  };

  const handlePickDate = (pickedDate) => {
    setShowDayPicker(false);
    focusDate(pickedDate);
  };

  const handleBackToToday = () => focusDate(todayRef.current);

  const handleEndReached = () => {
    if (!canLoadMoreRef.current || loadMoreState !== 'idle') {
      return;
    }
    // Sem essa guarda, uma agenda curta dispara onEndReached ja na montagem e
    // encadeia requisicoes ate o teto de lookahead.
    canLoadMoreRef.current = false;
    extendAgendaWindow();
  };

  // Sem getItemLayout (os cards tem altura variavel) o scroll para um indice ainda
  // nao renderizado falha; aqui aproximamos e tentamos de novo, no maximo 3 vezes.
  const handleScrollToIndexFailed = (info) => {
    const target = scrollTargetRef.current;

    if (!target || target.attempts >= 3) {
      scrollTargetRef.current = null;
      return;
    }

    target.attempts += 1;
    sectionListRef.current?.getScrollResponder()?.scrollTo({
      y: Math.max(0, (info.averageItemLength || 96) * info.index),
      animated: false,
    });

    setTimeout(() => {
      const sectionIndex = findSectionIndexByKey(sectionsRef.current, target.key);
      if (sectionIndex >= 0) {
        sectionListRef.current?.scrollToLocation({
          sectionIndex,
          itemIndex: 0,
          viewPosition: 0,
          animated: false,
        });
      }
    }, 120);
  };

  useEffect(() => {
    const bootstrap = async () => {
      // A agenda sempre abre em hoje: a janela de 30 dias ja traz os proximos
      // atendimentos, entao nao existe mais o pulo para o proximo dia ocupado.
      const today = todayRef.current;
      const initialMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setSelectedDate(today);
      setVisibleCalendarMonth(initialMonth);

      try {
        await Promise.all([
          loadClientsAndServices(),
          loadAgendaWindow(today),
          loadCalendarMarks(initialMonth),
        ]);
      } catch (error) {
        if (!isSessionExpiredError(error)) {
          Alert.alert('Erro', 'Não foi possível carregar os dados iniciais da agenda.');
        }
        setLoading(false);
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rola ate a secao pedida. Depende de `sections` porque a secao pode so
  // existir depois que a janela terminar de carregar.
  useEffect(() => {
    const target = scrollTargetRef.current;

    // `consumed` evita que qualquer mudanca posterior em `sections` (troca de
    // status, carregar mais dias) role a lista de volta para o alvo antigo.
    if (!target || target.consumed || sections.length === 0) {
      return;
    }

    const sectionIndex = findSectionIndexByKey(sections, target.key);

    if (sectionIndex < 0) {
      return;
    }

    target.consumed = true;
    sectionListRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      viewPosition: 0,
      viewOffset: 0,
      animated: !reduceMotionEnabled,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequestId, sections]);

  useEffect(() => {
    if (!modalVisible) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      if (clientSearch.trim()) {
        loadClientOptions(clientSearch);
        return;
      }

      setClients(selectedClientOption ? [selectedClientOption] : []);
      setClientSearchLoading(false);
    }, clientSearch.trim() ? 300 : 0);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible, clientSearch]);

  useEffect(() => {
    if (!modalVisible || form.depositMode !== 'percent') {
      return;
    }

    const percent = form.depositPercent ?? DEFAULT_DEPOSIT_PERCENT;
    const nextDepositAmount = calculateDepositAmount(selectedServicesTotal.price, percent);

    setForm((prev) => (
      isSameCurrencyAmount(prev.depositAmount, nextDepositAmount)
        ? prev
        : { ...prev, depositAmount: nextDepositAmount }
    ));
  }, [form.depositMode, form.depositPercent, modalVisible, selectedServicesTotal.price]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadClientsAndServices(),
        loadAgendaWindow(selectedDate, { isRefresh: true, keepRange: true }),
        loadCalendarMarks(visibleCalendarMonth, { force: true }),
      ]);
    } catch (error) {
      console.error('Erro ao atualizar agenda:', error.response?.data || error.message);
      if (!isSessionExpiredError(error)) {
        Alert.alert('Erro', 'Não foi possível atualizar os dados da agenda.');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const openCreateModal = async () => {
    setClientSearch('');
    setServiceSearch('');
    setClients([]);
    setSelectedClientOption(null);
    const hasClients = await loadClientAvailability();

    if (!hasClients || services.length === 0) {
      Alert.alert(
        'Dados necessários',
        'Cadastre ao menos 1 cliente e 1 serviço para criar agendamentos.',
      );
      return;
    }

    const defaultStartAt = new Date(selectedDate);
    defaultStartAt.setHours(DAY_START_HOUR, 0, 0, 0);

    setIsEditing(false);
    setEditingAppointmentId(null);
    setForm({
      clientId: null,
      serviceIds: [],
      startAt: defaultStartAt,
      depositPercent: DEFAULT_DEPOSIT_PERCENT,
      depositAmount: 0,
      depositMode: 'percent',
      notes: '',
    });
    setDepositSyncToken((token) => token + 1);

    setModalVisible(true);
  };

  const openEditModal = async (appointment) => {
    animateNextLayout();
    closeAppointmentActions();
    setIsEditing(true);
    setEditingAppointmentId(appointment.id);
    setClientSearch('');
    setServiceSearch('');
    const appointmentServiceIds = getAppointmentServiceIds(appointment);
    const appointmentDepositAmount = roundCurrency(Number(appointment.depositAmount || 0));
    const appointmentDepositPercent = inferDepositPercent(
      appointmentDepositAmount,
      appointment.price,
      DEPOSIT_PERCENT_OPTIONS,
    );
    const appointmentClient = {
      id: appointment.clientId,
      name: appointment.clientName || 'Cliente',
      lastName: '',
    };

    setSelectedClientOption(appointmentClient);
    setClients([appointmentClient]);

    setForm({
      clientId: appointment.clientId,
      serviceIds: appointmentServiceIds,
      startAt: new Date(appointment.startAt),
      depositPercent: appointmentDepositPercent,
      depositAmount: appointmentDepositAmount,
      depositMode: appointmentDepositPercent === null ? 'manual' : 'percent',
      notes: appointment.notes || '',
    });
    setDepositSyncToken((token) => token + 1);

    setModalVisible(true);
  };

  const closeModal = React.useCallback(() => {
    setModalVisible(false);
    setShowStartPicker(false);
    setStartPickerMode('date');
    setSubmitting(false);
    setConflictConfirmationVisible(false);
    setClientSearch('');
    setServiceSearch('');
    setClientSearchLoading(false);
  }, []);

  const openStartPicker = (mode) => {
    setStartPickerMode(mode);
    setShowStartPicker(true);
  };

  const applyStartPickerValue = (pickedDate) => {
    if (startPickerMode === 'date') {
      setForm((prev) => {
        const nextStartAt = new Date(prev.startAt);
        nextStartAt.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
        return { ...prev, startAt: nextStartAt };
      });
      return;
    }

    setForm((prev) => {
      const nextStartAt = new Date(prev.startAt);
      nextStartAt.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0);
      return { ...prev, startAt: nextStartAt };
    });
  };

  const handleStartPickerConfirm = (pickedDate) => {
    setShowStartPicker(false);
    applyStartPickerValue(pickedDate);
    setStartPickerMode('date');
  };

  const handleStartPickerCancel = React.useCallback(() => {
    setShowStartPicker(false);
    setStartPickerMode('date');
  }, []);

  useEffect(() => {
    if (!modalVisible) {
      return undefined;
    }

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showStartPicker) {
        handleStartPickerCancel();
        return true;
      }

      if (submitting) {
        return true;
      }

      if (conflictConfirmationVisible) {
        setConflictConfirmationVisible(false);
        return true;
      }

      closeModal();
      return true;
    });

    return () => backSubscription.remove();
  }, [
    closeModal,
    conflictConfirmationVisible,
    handleStartPickerCancel,
    modalVisible,
    showStartPicker,
    submitting,
  ]);

  const handleDepositPercentPress = (percent) => {
    setForm((prev) => ({
      ...prev,
      depositPercent: percent,
      depositAmount: calculateDepositAmount(selectedServicesTotal.price, percent),
      depositMode: 'percent',
    }));
    setDepositSyncToken((token) => token + 1);
  };

  // O texto e a posicao do cursor ficam com o useCurrencyInput; aqui so entra o numero.
  const handleDepositAmountChange = useCallback((amount) => {
    setForm((prev) => ({
      ...prev,
      depositPercent: null,
      depositAmount: amount,
      depositMode: 'manual',
    }));
  }, []);

  const depositInput = useCurrencyInput({
    value: form.depositAmount,
    syncToken: depositSyncToken,
    onChangeValue: handleDepositAmountChange,
  });

  const hasLocalAppointmentConflict = () => {
    if (!form.startAt || selectedServicesTotal.estimatedTime <= 0) {
      return false;
    }

    const nextStartAt = form.startAt;
    const nextEndAt = new Date(nextStartAt.getTime() + selectedServicesTotal.estimatedTime * 60 * 1000);

    return activeAppointments.some((appointment) => {
      if (isEditing && String(appointment.id) === String(editingAppointmentId)) {
        return false;
      }

      return hasTimeOverlap(
        nextStartAt,
        nextEndAt,
        new Date(appointment.startAt),
        new Date(appointment.endAt),
      );
    });
  };

  const showAppointmentConflictFeedback = () => {
    setShowStartPicker(false);
    setStartPickerMode('date');
    setConflictConfirmationVisible(true);
  };

  const handleSaveAppointment = async (allowConflict = false) => {
    if (submitting) {
      return;
    }

    if (!form.clientId || form.serviceIds.length === 0 || !form.startAt) {
      Alert.alert('Campos obrigatórios', 'Selecione cliente, serviço e horário.');
      return;
    }

    const finalDepositAmount = roundCurrency(Number(form.depositAmount || 0));

    if (!Number.isFinite(finalDepositAmount) || finalDepositAmount < 0) {
      Alert.alert('Sinal inválido', 'Informe um valor de sinal válido.');
      return;
    }

    if (finalDepositAmount > roundCurrency(selectedServicesTotal.price)) {
      Alert.alert('Sinal inválido', 'O valor do sinal não pode ser maior que o valor total do agendamento.');
      return;
    }

    if (!allowConflict && hasLocalAppointmentConflict()) {
      showAppointmentConflictFeedback();
      return;
    }

    const payload = {
      clientId: form.clientId,
      serviceIds: form.serviceIds,
      startAt: form.startAt.toISOString(),
      depositAmount: finalDepositAmount,
      notes: form.notes,
      ...(allowConflict ? { allowConflict: true } : {}),
    };

    setConflictConfirmationVisible(false);
    setSubmitting(true);

    if (isEditing && editingAppointmentId) {
      const previousAppointment = appointments.find((item) => (
        String(item.id) === String(editingAppointmentId)
      ));

      try {
        const updated = await updateAppointment(editingAppointmentId, payload);
        setAppointments((prev) => {
          const withoutEditedAppointment = prev.filter((item) => (
            String(item.id) !== String(editingAppointmentId)
          ));

          return isWithinLoadedWindow(updated.startAt)
            ? sortAppointments([...withoutEditedAppointment, updated])
            : sortAppointments(withoutEditedAppointment);
        });
        closeModal();
        refreshCalendarMarksForDates([previousAppointment?.startAt, updated.startAt]);
        focusDate(new Date(updated.startAt));
      } catch (error) {
        if (!allowConflict && isAppointmentConflictError(error)) {
          showAppointmentConflictFeedback();
          return;
        }

        Alert.alert('Erro', getAppointmentErrorMessage(error, 'Não foi possível atualizar agendamento.'));
      } finally {
        setSubmitting(false);
      }

      return;
    }

    try {
      const created = await createAppointment(payload);
      if (isWithinLoadedWindow(created.startAt)) {
        setAppointments((prev) => sortAppointments([...prev, created]));
      }
      closeModal();
      refreshCalendarMarksForDates([created.startAt]);
      // Leva a usuaria ate o dia salvo, mesmo que ele esteja fora da janela atual.
      focusDate(new Date(created.startAt));
    } catch (error) {
      if (!allowConflict && isAppointmentConflictError(error)) {
        showAppointmentConflictFeedback();
        return;
      }

      Alert.alert('Erro', getAppointmentErrorMessage(error, 'Não foi possível criar agendamento.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (appointmentId, nextStatus) => {
    const previousItem = appointments.find((item) => String(item.id) === String(appointmentId));
    if (!previousItem || previousItem.status === nextStatus) {
      return;
    }

    animateNextLayout();
    closeAppointmentActions();

    const isRestoring = isCanceledAppointment(previousItem) && nextStatus === 'scheduled';

    if ((nextStatus === 'completed' || isRestoring) && !reduceMotionEnabled) {
      setStatusAnimationAppointmentId(appointmentId);
      statusChangeAnimation.setValue(0);
      Animated.timing(statusChangeAnimation, {
        toValue: 1,
        duration: ACTION_ANIMATION_DURATION,
        useNativeDriver: true,
      }).start(() => setStatusAnimationAppointmentId(null));
    }

    setAppointments((prev) => sortAppointments(prev.map((item) => (
      String(item.id) === String(appointmentId) ? { ...item, status: nextStatus } : item
    ))));

    try {
      const updated = await updateAppointmentStatus(appointmentId, nextStatus);

      animateNextLayout();
      setAppointments((prev) => sortAppointments(prev.map((item) => (
        String(item.id) === String(appointmentId) ? updated : item
      ))));

      if (isCanceledAppointment(previousItem) !== isCanceledAppointment(updated)) {
        refreshCalendarMarksForDates([previousItem.startAt, updated.startAt]);
      }
    } catch (error) {
      animateNextLayout();
      setAppointments((prev) => sortAppointments(prev.map((item) => (
        String(item.id) === String(appointmentId) ? previousItem : item
      ))));

      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível atualizar status.');
    }
  };

  const showAppointmentActions = (appointment, position) => {
    setExpandedAppointmentId(appointment.id);
    setActionPopoverPosition(position);
    setDeleteConfirmationId(null);

    if (reduceMotionEnabled) {
      actionMenuAnimation.setValue(1);
      return;
    }

    actionMenuAnimation.setValue(0);
    Animated.timing(actionMenuAnimation, {
      toValue: 1,
      duration: ACTION_ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();
  };

  const toggleAppointmentActions = (appointment) => {
    if (String(expandedAppointmentId) === String(appointment.id)) {
      closeAppointmentActions();
      return;
    }

    closeAppointmentActions();
    const actionButton = actionButtonRefs.current[String(appointment.id)];

    const positionPopover = (buttonX, buttonY, buttonWidth, buttonHeight, rootX, rootY, rootWidth, rootHeight) => {
      const popoverWidth = Math.min(
        ACTION_POPOVER_MAX_WIDTH,
        rootWidth - ACTION_POPOVER_SCREEN_MARGIN * 2,
      );
      const relativeButtonX = buttonX - rootX;
      const relativeButtonY = buttonY - rootY;
      const left = Math.min(
        Math.max(
          ACTION_POPOVER_SCREEN_MARGIN,
          relativeButtonX + buttonWidth - popoverWidth,
        ),
        rootWidth - popoverWidth - ACTION_POPOVER_SCREEN_MARGIN,
      );
      const belowTop = relativeButtonY + buttonHeight + 2;
      const availableBottom = rootHeight - bottomInset - 8;
      const opensBelow = belowTop + ACTION_POPOVER_ESTIMATED_HEIGHT <= availableBottom;

      showAppointmentActions(appointment, {
        left,
        top: opensBelow ? belowTop : undefined,
        bottom: opensBelow ? undefined : rootHeight - relativeButtonY + 2,
        width: popoverWidth,
        placement: opensBelow ? 'below' : 'above',
      });
    };

    if (!actionButton?.measureInWindow) {
      showAppointmentActions(appointment, {
        left: Math.max(ACTION_POPOVER_SCREEN_MARGIN, windowWidth - ACTION_POPOVER_MAX_WIDTH - 16),
        top: insets.top + 72,
        width: Math.min(ACTION_POPOVER_MAX_WIDTH, windowWidth - 32),
        placement: 'below',
      });
      return;
    }

    actionButton.measureInWindow((buttonX, buttonY, buttonWidth, buttonHeight) => {
      if (!screenRef.current?.measureInWindow) {
        positionPopover(
          buttonX,
          buttonY,
          buttonWidth,
          buttonHeight,
          0,
          0,
          windowWidth,
          windowHeight,
        );
        return;
      }

      screenRef.current.measureInWindow((rootX, rootY, rootWidth, rootHeight) => {
        positionPopover(
          buttonX,
          buttonY,
          buttonWidth,
          buttonHeight,
          rootX,
          rootY,
          rootWidth,
          rootHeight,
        );
      });
    });
  };

  const openDeleteConfirmation = (appointmentId) => {
    animateNextLayout();
    setDeleteConfirmationId(appointmentId);
  };

  const closeDeleteConfirmation = () => {
    animateNextLayout();
    setDeleteConfirmationId(null);
  };

  const handleDeleteAppointment = async (appointment) => {
    if (deletingAppointmentId !== null) {
      return;
    }

    setDeletingAppointmentId(appointment.id);

    try {
      const canceledAppointment = await updateAppointmentStatus(appointment.id, 'canceled');
      animateNextLayout();
      setAppointments((prev) => sortAppointments(prev.map((item) => (
        String(item.id) === String(appointment.id) ? canceledAppointment : item
      ))));
      closeAppointmentActions();
      refreshCalendarMarksForDates([appointment.startAt]);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível excluir o atendimento.');
    } finally {
      setDeletingAppointmentId(null);
    }
  };

  const renderAppointmentActionsPopover = () => {
    const appointment = appointments.find((item) => (
      String(item.id) === String(expandedAppointmentId)
    ));

    if (!appointment || !actionPopoverPosition) {
      return null;
    }

    const isConfirmingDelete = String(deleteConfirmationId) === String(appointment.id);
    const isDeleting = String(deletingAppointmentId) === String(appointment.id);
    const opensBelow = actionPopoverPosition.placement === 'below';
    const animatedPopoverStyle = {
      opacity: actionMenuAnimation,
      transform: [
        {
          translateX: actionMenuAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [8, 0],
          }),
        },
        {
          translateY: actionMenuAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [opensBelow ? -6 : 6, 0],
          }),
        },
        {
          scale: actionMenuAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
          }),
        },
      ],
    };

    return (
      <View style={styles.actionPopoverOverlay}>
        <TouchableOpacity
          style={styles.actionPopoverBackdrop}
          activeOpacity={1}
          onPress={closeAppointmentActions}
          accessibilityRole="button"
          accessibilityLabel="Fechar ações do atendimento"
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.actionPopover,
            {
              left: actionPopoverPosition.left,
              top: actionPopoverPosition.top,
              bottom: actionPopoverPosition.bottom,
              width: actionPopoverPosition.width,
            },
            animatedPopoverStyle,
          ]}
        >
          {appointment.status === 'canceled' ? (
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => handleStatusChange(appointment.id, 'scheduled')}
            >
              <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
              <Text style={styles.actionMenuText}>Restaurar atendimento</Text>
            </TouchableOpacity>
          ) : !isConfirmingDelete ? (
            <>
              <TouchableOpacity style={styles.actionMenuItem} onPress={() => openEditModal(appointment)}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={styles.actionMenuText}>Editar agendamento</Text>
              </TouchableOpacity>
              {appointment.status === 'scheduled' && (
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={() => handleStatusChange(appointment.id, 'completed')}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                  <Text style={styles.actionMenuText}>Atendimento concluído</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => openDeleteConfirmation(appointment.id)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.actionMenuText, styles.destructiveActionText]}>
                  Excluir atendimento
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.deleteConfirmation}>
              <Text style={styles.deleteConfirmationTitle}>Excluir atendimento?</Text>
              <Text style={styles.deleteConfirmationText}>
                Ele ficará cancelado, sem ocupar o horário, e poderá ser restaurado depois.
              </Text>
              <View style={styles.deleteConfirmationActions}>
                <TouchableOpacity
                  style={styles.deleteConfirmationSecondaryButton}
                  onPress={closeDeleteConfirmation}
                  disabled={isDeleting}
                >
                  <Text style={styles.deleteConfirmationSecondaryText}>Manter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteConfirmationButton, isDeleting && styles.disabledButton]}
                  onPress={() => handleDeleteAppointment(appointment)}
                  disabled={isDeleting}
                >
                  <Text style={styles.deleteConfirmationButtonText}>
                    {isDeleting ? 'Excluindo...' : 'Excluir atendimento'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    );
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderTitleRow}>
        {section.relativeLabel && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{section.relativeLabel}</Text>
          </View>
        )}
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {formatSectionDate(section.date)}
        </Text>
      </View>
      <Text style={styles.sectionMeta}>
        {section.activeCount === 1 ? '1 atendimento' : `${section.activeCount} atendimentos`}
      </Text>
    </View>
  );

  const renderAppointmentItem = ({ item }) => {
    if (isDayPlaceholder(item)) {
      return (
        <View style={styles.emptyDayRow}>
          <Text style={styles.emptyDayText}>Nenhum atendimento</Text>
        </View>
      );
    }

    const isExpanded = String(expandedAppointmentId) === String(item.id);
    const isAnimatingStatus = String(statusAnimationAppointmentId) === String(item.id);
    const isCanceled = isCanceledAppointment(item);
    const animatedActionIconStyle = isExpanded ? {
      transform: [
        {
          rotate: actionMenuAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '90deg'],
          }),
        },
        {
          scale: actionMenuAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.05],
          }),
        },
      ],
    } : undefined;

    return (
      <Animated.View style={[
        styles.card,
        isCanceled && styles.canceledCard,
        isAnimatingStatus && {
          opacity: statusChangeAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.82, 1],
          }),
          transform: [{
            scale: statusChangeAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.99, 1],
            }),
          }],
        },
      ]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTime, isCanceled && styles.canceledCardText]} numberOfLines={1}>
            {formatTime(item.startAt)} - {formatTime(item.endAt)}
          </Text>
          <View style={styles.cardHeaderActions}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || colors.darkGray }]}>
              <Text style={styles.statusBadgeText}>{statusLabels[item.status] || item.status}</Text>
            </View>
            <TouchableOpacity
              ref={(node) => {
                const itemKey = String(item.id);
                if (node) {
                  actionButtonRefs.current[itemKey] = node;
                } else {
                  delete actionButtonRefs.current[itemKey];
                }
              }}
              style={styles.actionTriggerButton}
              hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
              onPress={() => toggleAppointmentActions(item)}
              accessibilityRole="button"
              accessibilityLabel={isExpanded ? 'Fechar ações do atendimento' : 'Abrir ações do atendimento'}
              accessibilityState={{ expanded: isExpanded }}
            >
              <Animated.View style={animatedActionIconStyle}>
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.primary} />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardDetailsRow}>
          <View style={styles.cardMainInfo}>
            <Text style={[styles.cardTitle, isCanceled && styles.canceledCardText]} numberOfLines={2}>
              {item.clientName || 'Cliente'}
            </Text>
            <Text style={[styles.cardSubtitle, isCanceled && styles.canceledCardText]} numberOfLines={2}>
              {getAppointmentServiceName(item) || 'Serviço'}
            </Text>
          </View>
          {googleSyncLabels[item.googleSyncStatus] && (
            <View style={[
              styles.googleSyncBadge,
              { borderColor: googleSyncColors[item.googleSyncStatus] || colors.border },
            ]}>
              <Ionicons
                name={item.googleSyncStatus === 'failed' ? 'cloud-offline-outline' : 'cloud-done-outline'}
                size={13}
                color={googleSyncColors[item.googleSyncStatus] || colors.darkGray}
              />
              <Text
                numberOfLines={2}
                style={[
                  styles.googleSyncBadgeText,
                  { color: googleSyncColors[item.googleSyncStatus] || colors.darkGray },
                ]}
              >
                {googleSyncLabels[item.googleSyncStatus]}
              </Text>
            </View>
          )}
        </View>

      </Animated.View>
    );
  };

  const renderEmptyAgenda = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-clear-outline" size={64} color={colors.lightGray} />
      <Text style={styles.emptyTitle}>Nenhum agendamento no período</Text>
      <Text style={styles.emptySubtitle}>Crie seu primeiro agendamento em poucos toques.</Text>

      {!canSchedule && (
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={() => navigation.navigate('RegisterCustomer')}
          >
            <Text style={styles.emptyActionText}>Cadastrar Cliente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={() => navigation.navigate('RegisterService')}
          >
            <Text style={styles.emptyActionText}>Cadastrar Serviço</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderAgendaFooter = () => (
    <View>
      {windowSummary.appointments === 0 && renderEmptyAgenda()}
      {loadMoreState === 'loading' && (
        <Text style={styles.footerText}>Carregando mais dias...</Text>
      )}
      {loadMoreState === 'error' && (
        <TouchableOpacity style={styles.footerButton} onPress={extendAgendaWindow}>
          <Text style={styles.footerButtonText}>Não deu para carregar. Tentar novamente</Text>
        </TouchableOpacity>
      )}
      {loadMoreState === 'exhausted' && (
        <Text style={styles.footerText}>Você chegou ao fim dos próximos 12 meses.</Text>
      )}
    </View>
  );

  const renderConflictConfirmation = () => {
    if (!conflictConfirmationVisible) {
      return null;
    }

    return (
      <View style={styles.conflictConfirmationOverlay} accessibilityViewIsModal>
        <TouchableOpacity
          style={styles.conflictConfirmationBackdrop}
          activeOpacity={1}
          onPress={() => setConflictConfirmationVisible(false)}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Voltar e ajustar horário"
        />
        <View style={styles.conflictConfirmationCard}>
          <View style={styles.conflictConfirmationIcon}>
            <Ionicons name="alert-circle" size={28} color={colors.warning} />
          </View>
          <Text style={styles.conflictConfirmationTitle}>Conflito de horário</Text>
          <Text style={styles.conflictConfirmationMessage}>
            Já existe outro agendamento nesse horário. Deseja agendar mesmo assim?
          </Text>
          <Text style={styles.conflictConfirmationHint}>
            Você pode voltar para alterar a data ou o horário sem perder o que preencheu.
          </Text>
          <View style={styles.conflictConfirmationActions}>
            <TouchableOpacity
              style={[
                styles.conflictConfirmationAction,
                styles.conflictConfirmationSecondaryAction,
                submitting && styles.disabledButton,
              ]}
              onPress={() => setConflictConfirmationVisible(false)}
              disabled={submitting}
            >
              <Text style={styles.conflictConfirmationSecondaryActionText}>Voltar e ajustar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.conflictConfirmationAction,
                styles.conflictConfirmationPrimaryAction,
                submitting && styles.disabledButton,
              ]}
              onPress={() => handleSaveAppointment(true)}
              disabled={submitting}
            >
              <Text style={styles.conflictConfirmationPrimaryActionText}>
                {submitting ? 'Salvando...' : 'Agendar mesmo assim'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando agenda...</Text>
      </View>
    );
  }

  return (
    <View ref={screenRef} style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Agenda</Text>
        <View style={styles.headerActions}>
          {!isWindowShowingToday && (
            <TouchableOpacity style={styles.todayButton} onPress={handleBackToToday}>
              <Text style={styles.todayButtonText}>Hoje</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.dayButton} onPress={openDayPicker}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.dayButtonText}>{formatDateLabel(selectedDate)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <DateTimePickerModal
        visible={showDayPicker}
        value={selectedDate}
        mode="date"
        title="Escolher dia"
        iosDisplay="inline"
        useAppPicker
        markedDates={markedDates}
        onVisibleMonthChange={handleVisibleMonthChange}
        onCancel={() => setShowDayPicker(false)}
        onConfirm={handlePickDate}
      />

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Atendimentos</Text>
            <Text style={styles.summaryValue}>{windowSummary.appointments}</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>Previsto</Text>
            <Text style={styles.summaryValue}>{formatCurrency(windowSummary.forecast)}</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>Dias ocupados</Text>
            <Text style={styles.summaryValue}>{windowSummary.busyDays}</Text>
          </View>
        </View>
        <Text style={styles.summaryPeriod}>
          {formatShortDate(agendaWindow.start)} a {formatShortDate(agendaWindow.end)}
        </Text>
      </View>

      <SectionList
        ref={sectionListRef}
        style={styles.list}
        sections={sections}
        keyExtractor={(item) => (
          isDayPlaceholder(item) ? `empty-${item.dateKey}` : String(item.id)
        )}
        renderItem={renderAppointmentItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        extraData={`${expandedAppointmentId}-${statusAnimationAppointmentId}`}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: 96 + bottomInset },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={AGENDA_END_REACHED_THRESHOLD}
        onMomentumScrollBegin={() => { canLoadMoreRef.current = true; }}
        onEndReached={handleEndReached}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScrollBeginDrag={closeAppointmentActions}
        ListFooterComponent={renderAgendaFooter}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={10}
        alwaysBounceVertical
      />

      <TouchableOpacity style={[styles.fab, { bottom: 16 + bottomInset }]} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {renderAppointmentActionsPopover()}

      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: 14 + insets.top, paddingBottom: 14 + bottomInset }]}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>{isEditing ? 'Editar agendamento' : 'Novo agendamento'}</Text>

              <Text style={styles.fieldLabel}>Cliente</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={colors.darkGray} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar cliente"
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {clientSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setClientSearch('')}>
                    <Ionicons name="close-circle" size={18} color={colors.darkGray} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.chipsWrap}>
                {clients.map((client) => {
                  const isActive = Number(form.clientId) === Number(client.id);
                  return (
                    <TouchableOpacity
                      key={client.id}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => {
                        setSelectedClientOption(client);
                        setForm((prev) => ({ ...prev, clientId: client.id }));
                      }}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {client.name} {client.lastName || ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {clientSearchLoading && (
                  <Text style={styles.helperText}>Buscando...</Text>
                )}
                {!clientSearchLoading && !clientSearch.trim() && clients.length === 0 && (
                  <Text style={styles.helperText}>Digite para buscar uma cliente.</Text>
                )}
                {!clientSearchLoading && clientSearch.trim() && clients.length === 0 && (
                  <Text style={styles.helperText}>Nenhum cliente encontrado.</Text>
                )}
              </View>

              <Text style={styles.fieldLabel}>Procedimento</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={colors.darkGray} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar procedimento"
                  value={serviceSearch}
                  onChangeText={setServiceSearch}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {serviceSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setServiceSearch('')}>
                    <Ionicons name="close-circle" size={18} color={colors.darkGray} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.chipsWrap}>
                {serviceOptions.map((service) => {
                  const isActive = form.serviceIds.some((serviceId) => Number(serviceId) === Number(service.id));
                  return (
                    <TouchableOpacity
                      key={service.id}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => {
                        const nextServiceIds = isActive
                          ? form.serviceIds.filter((serviceId) => Number(serviceId) !== Number(service.id))
                          : [...form.serviceIds, service.id];

                        setForm((prev) => ({
                          ...prev,
                          serviceIds: nextServiceIds,
                        }));
                      }}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {service.name} ({service.estimatedTime} min)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {!serviceSearch.trim() && selectedServices.length === 0 && (
                  <Text style={styles.helperText}>Digite para buscar um procedimento.</Text>
                )}
                {serviceSearch.trim() && searchedServiceOptions.length === 0 && (
                  <Text style={styles.helperText}>Nenhum procedimento encontrado.</Text>
                )}
              </View>
              {selectedServices.length > 0 && (
                <Text style={styles.selectionSummary}>
                  {selectedServices.length} serviço(s) - {selectedServicesTotal.estimatedTime} min - {formatCurrency(selectedServicesTotal.price)}
                </Text>
              )}

              <Text style={styles.fieldLabel}>Sinal</Text>
              <View style={styles.depositCompact}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.depositOptions}
                >
                  {DEPOSIT_PERCENT_OPTIONS.map((percent) => {
                    const isActive = form.depositPercent !== null && Number(form.depositPercent) === percent;

                    return (
                      <TouchableOpacity
                        key={percent}
                        style={[styles.depositOption, isActive && styles.depositOptionActive]}
                        onPress={() => handleDepositPercentPress(percent)}
                      >
                        <Text style={[styles.depositOptionText, isActive && styles.depositOptionTextActive]}>
                          {percent}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.depositInputRow}>
                  <Text style={styles.depositInputPrefix}>R$</Text>
                  <TextInput
                    style={styles.depositInput}
                    {...depositInput}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    accessibilityLabel="Valor do sinal em reais"
                  />
                </View>
                <View style={styles.depositSummaryGrid}>
                  <View style={styles.depositSummaryItem}>
                    <Text style={styles.depositSummaryLabel}>Valor total</Text>
                    <Text style={styles.depositSummaryValue}>{formatCurrency(selectedServicesTotal.price)}</Text>
                  </View>
                  <View style={styles.depositSummaryItem}>
                    <Text style={styles.depositSummaryLabel}>Valor do sinal</Text>
                    <Text style={styles.depositSummaryValue}>{formatCurrency(selectedDepositAmount)}</Text>
                  </View>
                  <View style={styles.depositSummaryItem}>
                    <Text style={styles.depositSummaryLabel}>Falta pagar</Text>
                    <Text style={styles.depositSummaryValue}>{formatCurrency(selectedRemainingAmount)}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Data e horário</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={styles.dateTimeButton} onPress={() => openStartPicker('date')}>
                  <View style={styles.dateTimeButtonHeader}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={styles.dateTimeButtonLabel}>Data</Text>
                  </View>
                  <Text style={styles.dateTimeButtonValue}>{formatShortDate(form.startAt)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateTimeButton} onPress={() => openStartPicker('time')}>
                  <View style={styles.dateTimeButtonHeader}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.dateTimeButtonLabel}>Horário</Text>
                  </View>
                  <Text style={styles.dateTimeButtonValue}>{formatTime(form.startAt)}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Observações (opcional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Observações rápidas"
                multiline
                value={form.notes}
                onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.secondaryButton,
                    submitting && styles.disabledButton,
                  ]}
                  onPress={closeModal}
                  disabled={submitting}
                >
                  <Text style={[styles.modalButtonText, styles.secondaryButtonText]}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.primaryButton, submitting && styles.disabledButton]}
                  onPress={() => handleSaveAppointment()}
                  disabled={submitting}
                >
                  <Text style={styles.modalButtonText}>{submitting ? 'Salvando...' : 'Confirmar'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {renderConflictConfirmation()}
          </View>

          <DateTimePickerModal
            visible={showStartPicker}
            value={form.startAt}
            mode={startPickerMode}
            title={startPickerMode === 'date' ? 'Data do agendamento' : 'Horário do agendamento'}
            iosDisplay={startPickerMode === 'date' ? 'inline' : 'spinner'}
            minuteInterval={5}
            useAppPicker
            inlineSheet
            onCancel={handleStartPickerCancel}
            onConfirm={handleStartPickerConfirm}
          />

        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: colors.darkGray,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  todayButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  todayButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  dayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexShrink: 1,
  },
  dayButtonText: {
    color: colors.text,
    textTransform: 'capitalize',
    fontSize: 13,
    flexShrink: 1,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryPeriod: {
    marginTop: 10,
    color: colors.darkGray,
    fontSize: 11,
  },
  sectionHeader: {
    // Precisa ser opaco: o cabecalho fica grudado no topo enquanto a lista rola.
    backgroundColor: colors.background,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionHeaderTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  sectionBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sectionTitle: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sectionMeta: {
    color: colors.darkGray,
    fontSize: 11,
    flexShrink: 0,
  },
  emptyDayRow: {
    paddingVertical: 10,
    paddingHorizontal: 11,
    marginBottom: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  emptyDayText: {
    color: colors.darkGray,
    fontSize: 13,
  },
  footerText: {
    marginTop: 8,
    textAlign: 'center',
    color: colors.darkGray,
    fontSize: 12,
  },
  footerButton: {
    marginTop: 8,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryLabel: {
    color: colors.darkGray,
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  listContainer: {
    paddingBottom: 120,
  },
  list: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginBottom: 9,
  },
  canceledCard: {
    backgroundColor: colors.inputBackground,
    borderStyle: 'dashed',
  },
  canceledCardText: {
    color: colors.darkGray,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  cardTime: {
    flex: 1,
    marginRight: 4,
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionTriggerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.transparent,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMainInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
    lineHeight: 19,
  },
  cardSubtitle: {
    color: colors.darkGray,
    marginTop: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  googleSyncBadge: {
    maxWidth: '44%',
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  googleSyncBadgeText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  actionPopoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18,
    elevation: 18,
  },
  actionPopoverBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  actionPopover: {
    position: 'absolute',
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 20,
  },
  actionMenuItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  actionMenuText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  destructiveActionText: {
    color: colors.error,
  },
  deleteConfirmation: {
    paddingTop: 8,
  },
  deleteConfirmationTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  deleteConfirmationText: {
    marginTop: 5,
    color: colors.darkGray,
    fontSize: 13,
    lineHeight: 18,
  },
  deleteConfirmationActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  deleteConfirmationSecondaryButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  deleteConfirmationSecondaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteConfirmationButton: {
    flex: 1.4,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.error,
  },
  deleteConfirmationButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    color: colors.text,
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: 6,
    color: colors.darkGray,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyActions: {
    marginTop: 18,
    width: '100%',
    gap: 10,
  },
  emptyActionButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 12,
  },
  emptyActionText: {
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 20,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    marginTop: 7,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
    marginBottom: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  selectionSummary: {
    marginTop: 6,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  depositCompact: {
    marginBottom: 2,
  },
  depositOptions: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 2,
  },
  depositOption: {
    minWidth: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: colors.white,
  },
  depositOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  depositOptionText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  depositOptionTextActive: {
    color: colors.white,
  },
  depositInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
    minHeight: 42,
  },
  depositInputPrefix: {
    color: colors.darkGray,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  depositInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 8,
  },
  depositSummaryGrid: {
    marginTop: 8,
    gap: 4,
  },
  depositSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  depositSummaryLabel: {
    color: colors.darkGray,
    fontSize: 12,
  },
  depositSummaryValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    backgroundColor: colors.white,
    minHeight: 62,
    justifyContent: 'center',
  },
  dateTimeButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  dateTimeButtonLabel: {
    color: colors.darkGray,
    fontSize: 11,
    fontWeight: '700',
  },
  dateTimeButtonValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
    color: colors.text,
  },
  notesInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  helperText: {
    color: colors.darkGray,
    fontSize: 12,
  },
  conflictConfirmationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: colors.overlay,
    zIndex: 30,
    elevation: 30,
  },
  conflictConfirmationBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  conflictConfirmationCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 22,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  conflictConfirmationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
    marginBottom: 14,
  },
  conflictConfirmationTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  conflictConfirmationMessage: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  conflictConfirmationHint: {
    marginTop: 8,
    color: colors.darkGray,
    fontSize: 13,
    lineHeight: 18,
  },
  conflictConfirmationActions: {
    marginTop: 20,
    gap: 10,
  },
  conflictConfirmationAction: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  conflictConfirmationSecondaryAction: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  conflictConfirmationPrimaryAction: {
    backgroundColor: colors.primary,
  },
  conflictConfirmationSecondaryActionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  conflictConfirmationPrimaryActionText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.lightGray,
  },
  modalButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: colors.text,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default AgendaScreen;
