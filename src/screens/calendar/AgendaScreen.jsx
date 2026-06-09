import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
const DEFAULT_DEPOSIT_PERCENT = 30;
const DEPOSIT_PERCENT_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45];
const HIDDEN_CANCELED_APPOINTMENTS_KEY = 'hiddenCanceledAppointmentIds';

const statusLabels = {
  scheduled: 'Agendado',
  canceled: 'Cancelado',
  completed: 'Concluido',
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

const sortAppointments = (items) => [...items].sort(
  (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
);

const getHiddenCanceledAppointmentIds = async () => {
  try {
    const storedIds = await AsyncStorage.getItem(HIDDEN_CANCELED_APPOINTMENTS_KEY);
    const parsedIds = storedIds ? JSON.parse(storedIds) : [];

    return Array.isArray(parsedIds) ? parsedIds.map(String) : [];
  } catch (error) {
    console.error('Erro ao carregar agendamentos ocultos:', error);
    return [];
  }
};

const hideCanceledAppointmentLocally = async (appointmentId) => {
  const hiddenIds = await getHiddenCanceledAppointmentIds();
  const nextHiddenIds = Array.from(new Set([...hiddenIds, String(appointmentId)]));

  await AsyncStorage.setItem(HIDDEN_CANCELED_APPOINTMENTS_KEY, JSON.stringify(nextHiddenIds));
};

const filterHiddenCanceledAppointments = (items, hiddenIds) => {
  const hiddenIdsSet = new Set(hiddenIds.map(String));

  return items.filter((item) => (
    item.status !== 'canceled' || !hiddenIdsSet.has(String(item.id))
  ));
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

const inferDepositPercent = (depositAmount = 0, price = 0) => {
  const numericPrice = Number(price || 0);
  const numericDeposit = Number(depositAmount || 0);

  if (!numericPrice || !Number.isFinite(numericPrice) || !Number.isFinite(numericDeposit)) {
    return DEFAULT_DEPOSIT_PERCENT;
  }

  const currentPercent = (numericDeposit / numericPrice) * 100;
  return DEPOSIT_PERCENT_OPTIONS.reduce((closest, option) => (
    Math.abs(option - currentPercent) < Math.abs(closest - currentPercent) ? option : closest
  ), DEFAULT_DEPOSIT_PERCENT);
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

  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [hasClientRecords, setHasClientRecords] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [selectedClientOption, setSelectedClientOption] = useState(null);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [startPickerMode, setStartPickerMode] = useState('date');

  const [form, setForm] = useState({
    clientId: null,
    serviceIds: [],
    startAt: new Date(),
    depositPercent: DEFAULT_DEPOSIT_PERCENT,
    notes: '',
  });

  const canSchedule = hasClientRecords && services.length > 0;

  const selectedServices = useMemo(
    () => form.serviceIds
      .map((serviceId) => services.find((item) => Number(item.id) === Number(serviceId)))
      .filter(Boolean),
    [services, form.serviceIds],
  );

  const selectedServicesTotal = useMemo(
    () => calculateServicesTotal(selectedServices),
    [selectedServices],
  );

  const selectedDepositAmount = useMemo(
    () => calculateDepositAmount(selectedServicesTotal.price, form.depositPercent),
    [form.depositPercent, selectedServicesTotal.price],
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
    () => appointments.filter((item) => item.status !== 'canceled'),
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

  const loadAgenda = async ({ isRefresh = false } = {}) => {
    if (!isRefresh) {
      setLoading(true);
    }

    try {
      const { from, to } = buildDayUtcRange(selectedDate);
      const data = await listAppointments({ from, to });
      const hiddenCanceledAppointmentIds = await getHiddenCanceledAppointmentIds();
      const visibleAppointments = filterHiddenCanceledAppointments(data, hiddenCanceledAppointmentIds);
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

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadClientsAndServices();
        await loadAgenda();
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
    loadAgenda();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadClientsAndServices(), loadAgenda({ isRefresh: true })]);
  };

  const openCreateModal = async () => {
    setClientSearch('');
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
      serviceIds: [services[0].id],
      startAt: defaultStartAt,
      depositPercent: DEFAULT_DEPOSIT_PERCENT,
      notes: '',
    });

    setModalVisible(true);
  };

  const openEditModal = async (appointment) => {
    setIsEditing(true);
    setEditingAppointmentId(appointment.id);
    setClientSearch('');
    const appointmentServiceIds = getAppointmentServiceIds(appointment);
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
      depositPercent: inferDepositPercent(appointment.depositAmount, appointment.price),
      notes: appointment.notes || '',
    });

    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setShowStartPicker(false);
    setStartPickerMode('date');
    setSubmitting(false);
    setClientSearch('');
    setClientSearchLoading(false);
  };

  const openStartPicker = (mode) => {
    setStartPickerMode(mode);
    setShowStartPicker(true);
  };

  const handleStartPickerChange = (event, pickedDate) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }

    if (event?.type === 'dismissed' || !pickedDate) {
      if (Platform.OS === 'android') {
        setStartPickerMode('date');
      }
      return;
    }

    if (startPickerMode === 'date') {
      setForm((prev) => {
        const nextStartAt = new Date(prev.startAt);
        nextStartAt.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
        return { ...prev, startAt: nextStartAt };
      });

      if (Platform.OS === 'android') {
        setStartPickerMode('date');
      }
      return;
    }

    setForm((prev) => {
      const nextStartAt = new Date(prev.startAt);
      nextStartAt.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0);
      return { ...prev, startAt: nextStartAt };
    });
    if (Platform.OS === 'android') {
      setStartPickerMode('date');
    }
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

  const showAppointmentConflictAlert = () => {
    Alert.alert(
      'Conflito de horário',
      'Já existe outro agendamento nesse horário. Ajuste o horário e tente salvar novamente.',
    );
  };

  const handleSaveAppointment = async () => {
    if (submitting) {
      return;
    }

    if (!form.clientId || form.serviceIds.length === 0 || !form.startAt) {
      Alert.alert('Campos obrigatórios', 'Selecione cliente, serviço e horário.');
      return;
    }

    const payload = {
      clientId: form.clientId,
      serviceIds: form.serviceIds,
      startAt: form.startAt.toISOString(),
      depositAmount: selectedDepositAmount,
      notes: form.notes,
    };

    if (!Number.isFinite(payload.depositAmount) || payload.depositAmount < 0) {
      Alert.alert('Sinal inválido', 'Selecione uma porcentagem válida para o sinal.');
      return;
    }

    if (hasLocalAppointmentConflict()) {
      showAppointmentConflictAlert();
      return;
    }

    setSubmitting(true);

    if (isEditing && editingAppointmentId) {
      try {
        const updated = await updateAppointment(editingAppointmentId, payload);
        setAppointments((prev) => sortAppointments(prev.map((item) => (
          String(item.id) === String(editingAppointmentId) ? updated : item
        ))));
        closeModal();
      } catch (error) {
        if (isAppointmentConflictError(error)) {
          showAppointmentConflictAlert();
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
      setAppointments((prev) => sortAppointments([...prev, created]));
      closeModal();
    } catch (error) {
      if (isAppointmentConflictError(error)) {
        showAppointmentConflictAlert();
        return;
      }

      Alert.alert('Erro', getAppointmentErrorMessage(error, 'Não foi possível criar agendamento.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (appointmentId, nextStatus) => {
    const previousItem = appointments.find((item) => item.id === appointmentId);
    if (!previousItem || previousItem.status === nextStatus) {
      return;
    }

    setAppointments((prev) => sortAppointments(prev.map((item) => (
      item.id === appointmentId ? { ...item, status: nextStatus } : item
    ))));

    try {
      const updated = await updateAppointmentStatus(appointmentId, nextStatus);
      setAppointments((prev) => sortAppointments(prev.map((item) => (
        item.id === appointmentId ? updated : item
      ))));
    } catch (error) {
      setAppointments((prev) => sortAppointments(prev.map((item) => (
        item.id === appointmentId ? previousItem : item
      ))));

      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível atualizar status.');
    }
  };

  const handleRemoveCanceledAppointment = (appointment) => {
    if (appointment.status !== 'canceled') {
      return;
    }

    Alert.alert(
      'Excluir agendamento?',
      'Este agendamento será removido da agenda. No backend ele continuará cancelado.',
      [
        { text: 'Manter', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await hideCanceledAppointmentLocally(appointment.id);
              setAppointments((prev) => prev.filter((item) => String(item.id) !== String(appointment.id)));
            } catch (error) {
              console.error('Erro ao remover agendamento cancelado da agenda:', error);
              Alert.alert('Erro', 'Não foi possível remover este agendamento da agenda.');
            }
          },
        },
      ],
    );
  };

  const renderAppointmentItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTime}>{formatTime(item.startAt)} - {formatTime(item.endAt)}</Text>
        <View style={styles.cardHeaderActions}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || colors.darkGray }]}>
            <Text style={styles.statusBadgeText}>{statusLabels[item.status] || item.status}</Text>
          </View>
          {item.status === 'canceled' && (
            <TouchableOpacity
              style={styles.removeCanceledButton}
              onPress={() => handleRemoveCanceledAppointment(item)}
              accessibilityRole="button"
              accessibilityLabel="Excluir agendamento cancelado da agenda"
            >
              <Ionicons name="trash-outline" size={16} color={colors.darkGray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.cardTitle}>{item.clientName || 'Cliente'}</Text>
      <Text style={styles.cardSubtitle}>{getAppointmentServiceName(item) || 'Serviço'}</Text>
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
          <Text style={[
            styles.googleSyncBadgeText,
            { color: googleSyncColors[item.googleSyncStatus] || colors.darkGray },
          ]}>
            {googleSyncLabels[item.googleSyncStatus]}
          </Text>
        </View>
      )}
      <Text style={styles.cardPrice}>{formatCurrency(item.price)}</Text>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item)}>
          <Text style={styles.actionButtonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.completeButton]}
          onPress={() => handleStatusChange(item.id, 'completed')}
        >
          <Text style={styles.actionButtonText}>Concluir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => handleStatusChange(item.id, 'canceled')}
        >
          <Text style={styles.actionButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
        <TouchableOpacity style={styles.dayButton} onPress={() => setShowDayPicker(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.dayButtonText}>{formatDateLabel(selectedDate)}</Text>
        </TouchableOpacity>
      </View>

      {showDayPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, pickedDate) => {
            setShowDayPicker(false);
            if (pickedDate) {
              setSelectedDate(pickedDate);
            }
          }}
        />
      )}

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

      {appointments.length === 0 ? (
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
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAppointmentItem}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 96 + bottomInset }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: 16 + bottomInset }]} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: 14 + insets.top, paddingBottom: 14 + bottomInset }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
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

              <Text style={styles.fieldLabel}>Serviços</Text>
              <View style={styles.chipsWrap}>
                {services.map((service) => {
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
                    const isActive = Number(form.depositPercent) === percent;

                    return (
                      <TouchableOpacity
                        key={percent}
                        style={[styles.depositOption, isActive && styles.depositOptionActive]}
                        onPress={() => setForm((prev) => ({ ...prev, depositPercent: percent }))}
                      >
                        <Text style={[styles.depositOptionText, isActive && styles.depositOptionTextActive]}>
                          {percent}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.depositSummary}>
                  <Text style={styles.depositSummaryText}>
                    Valor do sinal: {formatCurrency(selectedDepositAmount)}
                  </Text>
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

              {showStartPicker && (
                <DateTimePicker
                  value={form.startAt}
                  mode={startPickerMode}
                  display="default"
                  onChange={handleStartPickerChange}
                />
              )}

              <Text style={styles.fieldLabel}>Observações (opcional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Observações rápidas"
                multiline
                value={form.notes}
                onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]} onPress={closeModal}>
                  <Text style={[styles.modalButtonText, styles.secondaryButtonText]}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.primaryButton, submitting && styles.disabledButton]}
                  onPress={handleSaveAppointment}
                  disabled={submitting}
                >
                  <Text style={styles.modalButtonText}>{submitting ? 'Salvando...' : 'Confirmar'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={submitting} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#ECACD1" />
          </View>
        </View>
      </Modal>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  loadingBox: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    gap: 6,
  },
  cardTime: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  removeCanceledButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  cardTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.darkGray,
    marginTop: 2,
  },
  googleSyncBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  googleSyncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardPrice: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  completeButton: {
    backgroundColor: colors.success,
  },
  cancelButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 12,
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
    flex: 1,
    backgroundColor: colors.white,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
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
  depositSummary: {
    marginTop: 6,
  },
  depositSummaryText: {
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
