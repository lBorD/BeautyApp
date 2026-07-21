import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from '../../components/DateTimePickerModal';
import colors from '../../constants/colors';
import api from '../../services/api';
import { isSessionExpiredError } from '../../services/sessionManager';
import {
  createAppointment,
  listAppointments,
  updateAppointment,
  updateAppointmentStatus,
} from '../../services/private/appointmentAPI';

const SLOT_STEP_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 19;
const CLIENT_SEARCH_LIMIT = 30;
const DEFAULT_DEPOSIT_PERCENT = 0;
const DEPOSIT_PERCENT_OPTIONS = [0, 15, 30];
const CALENDAR_LOOKAHEAD_DAYS = 90;
const ACTION_ANIMATION_DURATION = 180;

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

const isCanceledAppointment = (appointment) => appointment.status === 'canceled';

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

const sortAppointments = (items) => [...items].sort(
  (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
);

const filterVisibleAgendaAppointments = (items) => (
  items.filter((item) => !isCanceledAppointment(item))
);

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

const buildDayUtcRange = (date) => {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);

  const to = new Date(date);
  to.setHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
};

const padDatePart = (value) => String(value).padStart(2, '0');

const getLocalDateKey = (dateValue) => {
  const date = new Date(dateValue);
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
};

const getMonthKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
};

const buildCalendarGridUtcRange = (monthValue) => {
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

const buildInitialAgendaUtcRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const from = new Date(today);
  from.setDate(today.getDate() + 1);

  const to = new Date(today);
  to.setDate(today.getDate() + CALENDAR_LOOKAHEAD_DAYS);
  to.setHours(23, 59, 59, 999);

  return { from: from.toISOString(), to: to.toISOString() };
};

const isSameLocalDay = (firstDate, secondDate) => (
  getLocalDateKey(firstDate) === getLocalDateKey(secondDate)
);

const formatCurrency = (value = 0) => Number(value).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const roundCurrency = (value = 0) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const calculateServicesTotal = (services) => services.reduce((totals, service) => ({
  price: totals.price + Number(service.price || 0),
  estimatedTime: totals.estimatedTime + Number(service.estimatedTime || 0),
}), { price: 0, estimatedTime: 0 });

const calculateDepositAmount = (price = 0, percent = DEFAULT_DEPOSIT_PERCENT) => (
  roundCurrency((Number(price || 0) * Number(percent || 0)) / 100)
);

const formatCurrencyInput = (value = 0) => roundCurrency(value).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sanitizeCurrencyInput = (value = '') => String(value).replace(/[^\d.,]/g, '');

const parseCurrencyInput = (value = '') => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? roundCurrency(value) : null;
  }

  const sanitizedValue = sanitizeCurrencyInput(value);
  if (!sanitizedValue) {
    return 0;
  }

  const lastComma = sanitizedValue.lastIndexOf(',');
  const lastDot = sanitizedValue.lastIndexOf('.');
  const normalizedValue = lastComma > lastDot
    ? sanitizedValue.replace(/\./g, '').replace(',', '.')
    : sanitizedValue.replace(/,/g, '');
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? roundCurrency(parsedValue) : null;
};

const calculateRemainingAmount = (price = 0, depositAmount = 0) => {
  const total = Math.max(Number(price || 0), 0);
  const deposit = Math.max(Number(depositAmount || 0), 0);
  return roundCurrency(Math.max(total - deposit, 0));
};

const isSameCurrencyAmount = (firstValue = 0, secondValue = 0) => (
  Math.abs(roundCurrency(firstValue) - roundCurrency(secondValue)) < 0.01
);

const inferDepositPercent = (depositAmount = 0, price = 0) => {
  const numericPrice = Number(price || 0);
  const numericDeposit = Number(depositAmount || 0);

  if (!numericPrice || !Number.isFinite(numericPrice) || !Number.isFinite(numericDeposit)) {
    return null;
  }

  return DEPOSIT_PERCENT_OPTIONS.find((option) => (
    isSameCurrencyAmount(calculateDepositAmount(numericPrice, option), numericDeposit)
  )) ?? null;
};

const formatDateLabel = (date) => date.toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});

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

const createBaseSlots = (date) => {
  const slots = [];
  const cursor = new Date(date);
  cursor.setHours(DAY_START_HOUR, 0, 0, 0);

  const end = new Date(date);
  end.setHours(DAY_END_HOUR, 0, 0, 0);

  while (cursor < end) {
    slots.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + SLOT_STEP_MINUTES);
  }

  return slots;
};

const AgendaScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarMarksByMonth, setCalendarMarksByMonth] = useState({});
  const calendarMarksCacheRef = useRef({});
  const calendarCacheGenerationRef = useRef(0);
  const calendarRequestIdsRef = useRef({});
  const didBootstrapRef = useRef(false);
  const skipSelectedDateEffectRef = useRef(false);

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
    depositAmountInput: formatCurrencyInput(0),
    depositMode: 'percent',
    notes: '',
  });

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

  const freeSlotsCount = useMemo(() => {
    const baseSlots = createBaseSlots(selectedDate);

    return baseSlots.filter((slot) => !activeAppointments.some((appointment) => {
      const startAt = new Date(appointment.startAt);
      const endAt = new Date(appointment.endAt);
      return slot >= startAt && slot < endAt;
    })).length;
  }, [activeAppointments, selectedDate]);

  const totalForecast = useMemo(
    () => activeAppointments.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [activeAppointments],
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

  const loadAgendaForDate = async (date, { isRefresh = false } = {}) => {
    if (!isRefresh) {
      setLoading(true);
    }

    try {
      const { from, to } = buildDayUtcRange(date);
      const data = await listAppointments({ from, to });
      const visibleAppointments = filterVisibleAgendaAppointments(data);
      setAppointments(sortAppointments(visibleAppointments));
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

  useEffect(() => {
    const bootstrap = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let initialDate = today;

      try {
        const { from, to } = buildInitialAgendaUtcRange();
        const futureAppointments = filterVisibleAgendaAppointments(
          await listAppointments({ from, to }),
        );
        const nextAppointment = sortAppointments(futureAppointments)[0];

        if (nextAppointment) {
          initialDate = new Date(nextAppointment.startAt);
        }
      } catch (error) {
        console.error('Erro ao localizar próximo atendimento:', error.response?.data || error.message);
      }

      const initialMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
      didBootstrapRef.current = true;
      skipSelectedDateEffectRef.current = true;
      setSelectedDate(initialDate);
      setVisibleCalendarMonth(initialMonth);

      try {
        await Promise.all([
          loadClientsAndServices(),
          loadAgendaForDate(initialDate),
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

  useEffect(() => {
    if (!didBootstrapRef.current) {
      return;
    }

    if (skipSelectedDateEffectRef.current) {
      skipSelectedDateEffectRef.current = false;
      return;
    }

    animateNextLayout();
    setExpandedAppointmentId(null);
    setDeleteConfirmationId(null);
    loadAgendaForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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
    const nextDepositAmountInput = formatCurrencyInput(nextDepositAmount);

    setForm((prev) => {
      if (
        isSameCurrencyAmount(prev.depositAmount, nextDepositAmount)
        && prev.depositAmountInput === nextDepositAmountInput
      ) {
        return prev;
      }

      return {
        ...prev,
        depositAmount: nextDepositAmount,
        depositAmountInput: nextDepositAmountInput,
      };
    });
  }, [form.depositMode, form.depositPercent, modalVisible, selectedServicesTotal.price]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadClientsAndServices(),
        loadAgendaForDate(selectedDate, { isRefresh: true }),
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
      depositAmountInput: formatCurrencyInput(0),
      depositMode: 'percent',
      notes: '',
    });

    setModalVisible(true);
  };

  const openEditModal = async (appointment) => {
    animateNextLayout();
    setExpandedAppointmentId(null);
    setDeleteConfirmationId(null);
    setIsEditing(true);
    setEditingAppointmentId(appointment.id);
    setClientSearch('');
    setServiceSearch('');
    const appointmentServiceIds = getAppointmentServiceIds(appointment);
    const appointmentDepositAmount = roundCurrency(Number(appointment.depositAmount || 0));
    const appointmentDepositPercent = inferDepositPercent(appointmentDepositAmount, appointment.price);
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
      depositAmountInput: formatCurrencyInput(appointmentDepositAmount),
      depositMode: appointmentDepositPercent === null ? 'manual' : 'percent',
      notes: appointment.notes || '',
    });

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
    const nextDepositAmount = calculateDepositAmount(selectedServicesTotal.price, percent);

    setForm((prev) => ({
      ...prev,
      depositPercent: percent,
      depositAmount: nextDepositAmount,
      depositAmountInput: formatCurrencyInput(nextDepositAmount),
      depositMode: 'percent',
    }));
  };

  const handleDepositAmountChange = (value) => {
    const sanitizedValue = sanitizeCurrencyInput(value);
    const parsedDepositAmount = parseCurrencyInput(sanitizedValue);

    setForm((prev) => ({
      ...prev,
      depositPercent: null,
      depositAmount: parsedDepositAmount ?? 0,
      depositAmountInput: sanitizedValue,
      depositMode: 'manual',
    }));
  };

  const handleDepositAmountBlur = () => {
    const parsedDepositAmount = parseCurrencyInput(form.depositAmountInput);
    const nextDepositAmount = Math.max(parsedDepositAmount ?? 0, 0);

    setForm((prev) => ({
      ...prev,
      depositAmount: nextDepositAmount,
      depositAmountInput: formatCurrencyInput(nextDepositAmount),
      depositMode: 'manual',
    }));
  };

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

    const parsedDepositAmount = parseCurrencyInput(form.depositAmountInput);
    const finalDepositAmount = parsedDepositAmount === null ? null : roundCurrency(parsedDepositAmount);

    if (finalDepositAmount === null || !Number.isFinite(finalDepositAmount) || finalDepositAmount < 0) {
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

          return isSameLocalDay(updated.startAt, selectedDate)
            ? sortAppointments([...withoutEditedAppointment, updated])
            : sortAppointments(withoutEditedAppointment);
        });
        closeModal();
        refreshCalendarMarksForDates([previousAppointment?.startAt, updated.startAt]);
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
      if (isSameLocalDay(created.startAt, selectedDate)) {
        setAppointments((prev) => sortAppointments([...prev, created]));
      }
      closeModal();
      refreshCalendarMarksForDates([created.startAt]);
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
    setExpandedAppointmentId(null);
    setDeleteConfirmationId(null);
    actionMenuAnimation.setValue(0);

    if (nextStatus === 'completed' && !reduceMotionEnabled) {
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

      if (nextStatus === 'canceled' || isCanceledAppointment(updated)) {
        animateNextLayout();
        setAppointments((prev) => prev.filter((item) => String(item.id) !== String(appointmentId)));
        refreshCalendarMarksForDates([previousItem.startAt]);
        return;
      }

      animateNextLayout();
      setAppointments((prev) => sortAppointments(prev.map((item) => (
        String(item.id) === String(appointmentId) ? updated : item
      ))));
    } catch (error) {
      animateNextLayout();
      setAppointments((prev) => sortAppointments(prev.map((item) => (
        String(item.id) === String(appointmentId) ? previousItem : item
      ))));

      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível atualizar status.');
    }
  };

  const toggleAppointmentActions = (appointmentId) => {
    const willExpand = String(expandedAppointmentId) !== String(appointmentId);
    animateNextLayout();
    setDeleteConfirmationId(null);

    if (!willExpand) {
      setExpandedAppointmentId(null);
      actionMenuAnimation.setValue(0);
      return;
    }

    setExpandedAppointmentId(appointmentId);

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
      await updateAppointmentStatus(appointment.id, 'canceled');
      animateNextLayout();
      setAppointments((prev) => prev.filter((item) => String(item.id) !== String(appointment.id)));
      setExpandedAppointmentId(null);
      setDeleteConfirmationId(null);
      actionMenuAnimation.setValue(0);
      refreshCalendarMarksForDates([appointment.startAt]);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível excluir o atendimento.');
    } finally {
      setDeletingAppointmentId(null);
    }
  };

  const renderAppointmentItem = ({ item }) => {
    const isExpanded = String(expandedAppointmentId) === String(item.id);
    const isConfirmingDelete = String(deleteConfirmationId) === String(item.id);
    const isDeleting = String(deletingAppointmentId) === String(item.id);
    const isAnimatingStatus = String(statusAnimationAppointmentId) === String(item.id);
    const animatedMenuStyle = {
      opacity: actionMenuAnimation,
      transform: [{
        translateY: actionMenuAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [6, 0],
        }),
      }],
    };
    const animatedEditIconStyle = isExpanded ? {
      transform: [
        {
          rotate: actionMenuAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '-8deg'],
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
          <Text style={styles.cardTime} numberOfLines={1}>
            {formatTime(item.startAt)} - {formatTime(item.endAt)}
          </Text>
          <View style={styles.cardHeaderActions}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || colors.darkGray }]}>
              <Text style={styles.statusBadgeText}>{statusLabels[item.status] || item.status}</Text>
            </View>
            <TouchableOpacity
              style={[styles.editActionsButton, isExpanded && styles.editActionsButtonExpanded]}
              onPress={() => toggleAppointmentActions(item.id)}
              accessibilityRole="button"
              accessibilityLabel={isExpanded ? 'Fechar ações do atendimento' : 'Abrir ações do atendimento'}
              accessibilityState={{ expanded: isExpanded }}
            >
              <Animated.View style={animatedEditIconStyle}>
                <Ionicons name="pencil-outline" size={17} color={colors.primary} />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardDetailsRow}>
          <View style={styles.cardMainInfo}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.clientName || 'Cliente'}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={2}>
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

        {isExpanded && (
          <Animated.View style={[styles.actionMenu, animatedMenuStyle]}>
            {!isConfirmingDelete ? (
              <>
                <TouchableOpacity style={styles.actionMenuItem} onPress={() => openEditModal(item)}>
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                  <Text style={styles.actionMenuText}>Editar agendamento</Text>
                </TouchableOpacity>
                {item.status === 'scheduled' && (
                  <TouchableOpacity
                    style={styles.actionMenuItem}
                    onPress={() => handleStatusChange(item.id, 'completed')}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                    <Text style={styles.actionMenuText}>Atendimento concluído</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={() => openDeleteConfirmation(item.id)}
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
                  Ele sairá da agenda, mas continuará registrado no histórico como cancelado.
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
                    onPress={() => handleDeleteAppointment(item)}
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
        )}
      </Animated.View>
    );
  };

  const renderEmptyAgenda = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-clear-outline" size={64} color={colors.lightGray} />
      <Text style={styles.emptyTitle}>Nenhum agendamento neste dia</Text>
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
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Agenda</Text>
        <TouchableOpacity style={styles.dayButton} onPress={openDayPicker}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.dayButtonText}>{formatDateLabel(selectedDate)}</Text>
        </TouchableOpacity>
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
        onConfirm={(pickedDate) => {
          setShowDayPicker(false);
          setVisibleCalendarMonth(new Date(pickedDate.getFullYear(), pickedDate.getMonth(), 1));
          setSelectedDate(pickedDate);
        }}
      />

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Atendimentos</Text>
          <Text style={styles.summaryValue}>{activeAppointments.length}</Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>Previsto</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalForecast)}</Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>Livres</Text>
          <Text style={styles.summaryValue}>{freeSlotsCount}</Text>
        </View>
      </View>

      <FlatList
        style={styles.list}
        data={appointments}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderAppointmentItem}
        ListEmptyComponent={renderEmptyAgenda}
        contentContainerStyle={[
          styles.listContainer,
          appointments.length === 0 && styles.emptyListContainer,
          { paddingBottom: 96 + bottomInset },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        alwaysBounceVertical
      />

      <TouchableOpacity style={[styles.fab, { bottom: 16 + bottomInset }]} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

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
                    value={form.depositAmountInput}
                    onChangeText={handleDepositAmountChange}
                    onBlur={handleDepositAmountBlur}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
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
    maxWidth: '70%',
  },
  dayButtonText: {
    color: colors.text,
    textTransform: 'capitalize',
    fontSize: 13,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  emptyListContainer: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  cardTime: {
    flex: 1,
    marginRight: 8,
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  editActionsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  editActionsButtonExpanded: {
    borderColor: colors.primary,
    backgroundColor: colors.inputBackground,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardMainInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
    lineHeight: 21,
  },
  cardSubtitle: {
    color: colors.darkGray,
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  googleSyncBadge: {
    maxWidth: '44%',
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  googleSyncBadgeText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  actionMenu: {
    marginTop: 14,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
