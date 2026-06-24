import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import colors from '../../constants/colors';
import { isSessionExpiredError } from '../../services/sessionManager';
import { listAppointments } from '../../services/private/appointmentAPI';

const VALID_FINANCE_STATUSES = ['scheduled', 'completed'];

const statusLabels = {
  scheduled: 'Agendado',
  completed: 'Concluído',
};

const formatCurrency = (value = 0) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const roundCurrency = (value = 0) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const startOfMonth = (date) => {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfMonth = (date) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const isNotCanceled = (appointment) => appointment.status !== 'canceled';

const isValidFinanceAppointment = (appointment) => (
  isNotCanceled(appointment) && VALID_FINANCE_STATUSES.includes(appointment.status)
);

const getAppointmentDate = (appointment) => new Date(appointment.startAt);

const isInRange = (appointment, from, to) => {
  const time = getAppointmentDate(appointment).getTime();
  return Number.isFinite(time) && time >= from.getTime() && time <= to.getTime();
};

const getPositiveCurrencyValue = (value = 0) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? Math.max(numericValue, 0) : 0;
};

const getRemainingAmount = (appointment) => (
  Math.max(
    getPositiveCurrencyValue(appointment.price) - getPositiveCurrencyValue(appointment.depositAmount),
    0,
  )
);

const getAppointmentServiceName = (appointment) => {
  if (appointment.serviceName) {
    return appointment.serviceName;
  }

  if (!Array.isArray(appointment.services)) {
    return 'Serviço';
  }

  return appointment.services
    .map((service) => service.serviceName || service.name)
    .filter(Boolean)
    .join(' + ') || 'Serviço';
};

const formatAppointmentDate = (value) => new Date(value).toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

const formatAppointmentTime = (value) => new Date(value).toLocaleTimeString('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

const sumFinancials = (appointments) => {
  const totals = appointments.reduce((acc, appointment) => {
    const price = getPositiveCurrencyValue(appointment.price);
    const depositAmount = getPositiveCurrencyValue(appointment.depositAmount);

    return {
      total: acc.total + price,
      deposit: acc.deposit + depositAmount,
      remaining: acc.remaining + Math.max(price - depositAmount, 0),
    };
  }, { total: 0, deposit: 0, remaining: 0 });

  return {
    total: roundCurrency(totals.total),
    deposit: roundCurrency(totals.deposit),
    remaining: roundCurrency(totals.remaining),
  };
};

const formatMonthLabel = (date) => date.toLocaleDateString('pt-BR', {
  month: 'long',
  year: 'numeric',
});

const sortAppointmentsByDate = (items) => [...items].sort(
  (first, second) => new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
);

const getTopPendingAppointment = (appointments) => appointments.reduce((selected, appointment) => {
  if (!selected || getRemainingAmount(appointment) > getRemainingAmount(selected)) {
    return appointment;
  }

  return selected;
}, null);

const buildInsight = ({ title, subtitle, totals, appointments, emptyText }) => {
  const sortedAppointments = sortAppointmentsByDate(appointments);
  const topPendingAppointment = getTopPendingAppointment(sortedAppointments);
  const averageTicket = appointments.length > 0 ? totals.total / appointments.length : 0;
  const paidPercent = totals.total > 0
    ? Math.min(Math.round((totals.deposit / totals.total) * 100), 100)
    : 0;
  const now = Date.now();
  const nextAppointment = sortedAppointments.find((appointment) => (
    new Date(appointment.startAt).getTime() >= now
  )) || null;

  return {
    title,
    subtitle,
    totals,
    appointments: sortedAppointments,
    emptyText,
    averageTicket,
    paidPercent,
    topPendingAppointment,
    nextAppointment,
  };
};

const SummaryCard = ({ icon, label, value, detail, variant = 'default', onPress }) => (
  <TouchableOpacity
    style={[styles.summaryCard, variant === 'primary' && styles.summaryCardPrimary]}
    activeOpacity={0.82}
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : undefined}
  >
    <View style={[styles.summaryIcon, variant === 'primary' && styles.summaryIconPrimary]}>
      <Ionicons
        name={icon}
        size={18}
        color={variant === 'primary' ? colors.white : colors.primary}
      />
    </View>
    {onPress ? (
      <Ionicons
        name="chevron-forward"
        size={18}
        color={variant === 'primary' ? 'rgba(255, 255, 255, 0.75)' : colors.darkGray}
        style={styles.summaryChevron}
      />
    ) : null}
    <Text style={[styles.summaryLabel, variant === 'primary' && styles.summaryLabelPrimary]}>{label}</Text>
    <Text style={[styles.summaryValue, variant === 'primary' && styles.summaryValuePrimary]}>{value}</Text>
    {detail ? (
      <Text style={[styles.summaryDetail, variant === 'primary' && styles.summaryDetailPrimary]}>{detail}</Text>
    ) : null}
  </TouchableOpacity>
);

const MetricRow = ({ label, value, detail, onPress }) => (
  <TouchableOpacity
    style={styles.metricRow}
    activeOpacity={0.82}
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : undefined}
  >
    <View style={styles.metricTextArea}>
      <Text style={styles.metricLabel}>{label}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
    <View style={styles.metricValueArea}>
      <Text style={styles.metricValue}>{value}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.darkGray} /> : null}
    </View>
  </TouchableOpacity>
);

const DetailMetric = ({ label, value }) => (
  <View style={styles.detailMetric}>
    <Text style={styles.detailMetricLabel}>{label}</Text>
    <Text style={styles.detailMetricValue}>{value}</Text>
  </View>
);

const AppointmentDetailRow = ({ appointment }) => {
  const remainingAmount = getRemainingAmount(appointment);

  return (
    <View style={styles.appointmentRow}>
      <View style={styles.appointmentHeader}>
        <Text style={styles.appointmentClient}>{appointment.clientName || 'Cliente'}</Text>
        <Text style={styles.appointmentDate}>
          {formatAppointmentDate(appointment.startAt)} às {formatAppointmentTime(appointment.startAt)}
        </Text>
      </View>
      <Text style={styles.appointmentService}>{getAppointmentServiceName(appointment)}</Text>
      <View style={styles.appointmentFinanceRow}>
        <Text style={styles.appointmentFinanceText}>Total {formatCurrency(appointment.price)}</Text>
        <Text style={styles.appointmentFinanceText}>Sinal {formatCurrency(appointment.depositAmount)}</Text>
        <Text style={styles.appointmentFinanceText}>Falta {formatCurrency(remainingAmount)}</Text>
      </View>
      <Text style={styles.appointmentStatus}>{statusLabels[appointment.status] || appointment.status}</Text>
    </View>
  );
};

const InsightModal = ({ insight, onClose }) => (
  <Modal visible={!!insight} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleArea}>
            <Text style={styles.modalTitle}>{insight?.title}</Text>
            <Text style={styles.modalSubtitle}>{insight?.subtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar detalhes"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {insight ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailMetricsGrid}>
              <DetailMetric label="Agendamentos" value={String(insight.appointments.length)} />
              <DetailMetric label="Planejado" value={formatCurrency(insight.totals.total)} />
              <DetailMetric label="Sinais" value={formatCurrency(insight.totals.deposit)} />
              <DetailMetric label="Falta pagar" value={formatCurrency(insight.totals.remaining)} />
              <DetailMetric label="Ticket médio" value={formatCurrency(insight.averageTicket)} />
              <DetailMetric label="Sinalizado" value={`${insight.paidPercent}%`} />
            </View>

            <View style={styles.decisionBlock}>
              <Text style={styles.decisionTitle}>Ponto de atenção</Text>
              {insight.topPendingAppointment && getRemainingAmount(insight.topPendingAppointment) > 0 ? (
                <Text style={styles.decisionText}>
                  Maior falta pagar: {formatCurrency(getRemainingAmount(insight.topPendingAppointment))}
                  {' '}de {insight.topPendingAppointment.clientName || 'cliente'}.
                </Text>
              ) : (
                <Text style={styles.decisionText}>Nenhuma falta pagar relevante neste recorte.</Text>
              )}
              {insight.nextAppointment ? (
                <Text style={styles.decisionText}>
                  Próximo atendimento: {formatAppointmentDate(insight.nextAppointment.startAt)}
                  {' '}às {formatAppointmentTime(insight.nextAppointment.startAt)}.
                </Text>
              ) : null}
            </View>

            <Text style={styles.modalSectionTitle}>Agendamentos do recorte</Text>
            {insight.appointments.length > 0 ? (
              <>
                {insight.appointments.slice(0, 8).map((appointment) => (
                  <AppointmentDetailRow key={String(appointment.id)} appointment={appointment} />
                ))}
                {insight.appointments.length > 8 ? (
                  <Text style={styles.moreAppointmentsText}>
                    +{insight.appointments.length - 8} agendamento(s) neste recorte.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.modalEmptyText}>{insight.emptyText}</Text>
            )}
          </ScrollView>
        ) : null}
      </View>
    </View>
  </Modal>
);

const FinancaScreen = () => {
  const [appointments, setAppointments] = useState([]);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedInsightKey, setSelectedInsightKey] = useState(null);

  const loadFinanceSummary = useCallback(async ({ isRefresh = false } = {}) => {
    if (!isRefresh) {
      setLoading(true);
    }

    setErrorMessage('');

    try {
      const today = new Date();
      const from = startOfMonth(today).toISOString();
      const to = endOfMonth(addMonths(today, 1)).toISOString();
      const data = await listAppointments({ from, to });

      setReferenceDate(today);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error.response?.data || error.message);

      if (!isSessionExpiredError(error)) {
        setErrorMessage('Não foi possível carregar o financeiro.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFinanceSummary();
    }, [loadFinanceSummary]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFinanceSummary({ isRefresh: true });
  }, [loadFinanceSummary]);

  const {
    todayTotals,
    currentMonthTotals,
    nextMonthTotals,
    periodTotals,
    todayAppointments,
    currentMonthAppointments,
    nextMonthAppointments,
    validAppointments,
    currentMonthLabel,
    nextMonthLabel,
  } = useMemo(() => {
    const validAppointments = appointments.filter(isValidFinanceAppointment);
    const todayStart = startOfDay(referenceDate);
    const todayEnd = endOfDay(referenceDate);
    const currentMonthStart = startOfMonth(referenceDate);
    const currentMonthEnd = endOfMonth(referenceDate);
    const nextMonthDate = addMonths(referenceDate, 1);
    const nextMonthStart = startOfMonth(nextMonthDate);
    const nextMonthEnd = endOfMonth(nextMonthDate);

    const todayItems = validAppointments.filter((appointment) => isInRange(appointment, todayStart, todayEnd));
    const currentMonthItems = validAppointments.filter((appointment) => (
      isInRange(appointment, currentMonthStart, currentMonthEnd)
    ));
    const nextMonthItems = validAppointments.filter((appointment) => (
      isInRange(appointment, nextMonthStart, nextMonthEnd)
    ));

    return {
      todayTotals: sumFinancials(todayItems),
      currentMonthTotals: sumFinancials(currentMonthItems),
      nextMonthTotals: sumFinancials(nextMonthItems),
      periodTotals: sumFinancials(validAppointments),
      todayAppointments: todayItems,
      currentMonthAppointments: currentMonthItems,
      nextMonthAppointments: nextMonthItems,
      validAppointments,
      currentMonthLabel: formatMonthLabel(referenceDate),
      nextMonthLabel: formatMonthLabel(nextMonthDate),
    };
  }, [appointments, referenceDate]);

  const insights = useMemo(() => ({
    today: buildInsight({
      title: 'Hoje',
      subtitle: 'Faturamento e pendências do dia',
      totals: todayTotals,
      appointments: todayAppointments,
      emptyText: 'Nenhum agendamento válido hoje.',
    }),
    currentMonth: buildInsight({
      title: 'Este mês',
      subtitle: currentMonthLabel,
      totals: currentMonthTotals,
      appointments: currentMonthAppointments,
      emptyText: 'Nenhum agendamento válido neste mês.',
    }),
    nextMonth: buildInsight({
      title: 'Próximo mês',
      subtitle: nextMonthLabel,
      totals: nextMonthTotals,
      appointments: nextMonthAppointments,
      emptyText: 'Nenhum agendamento válido no próximo mês.',
    }),
    receivables: buildInsight({
      title: 'Recebimentos',
      subtitle: 'Mês atual + próximo',
      totals: periodTotals,
      appointments: validAppointments,
      emptyText: 'Nenhum recebimento previsto neste período.',
    }),
  }), [
    currentMonthAppointments,
    currentMonthLabel,
    currentMonthTotals,
    nextMonthAppointments,
    nextMonthLabel,
    nextMonthTotals,
    periodTotals,
    todayAppointments,
    todayTotals,
    validAppointments,
  ]);

  const selectedInsight = selectedInsightKey ? insights[selectedInsightKey] : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando financeiro...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
        />
      )}
    >
      <Text style={styles.title}>Financeiro</Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
          </View>
          <View style={styles.errorTextArea}>
            <Text style={styles.errorTitle}>Erro ao carregar</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadFinanceSummary()}>
            <Text style={styles.retryButtonText}>Tentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <SummaryCard
        icon="today-outline"
        label="Faturamento diário"
        value={formatCurrency(todayTotals.total)}
        detail={`${todayAppointments.length} agendamento(s) hoje`}
        variant="primary"
        onPress={() => setSelectedInsightKey('today')}
      />

      <View style={styles.summaryGrid}>
        <SummaryCard
          icon="calendar-outline"
          label="Planejado do mês"
          value={formatCurrency(currentMonthTotals.total)}
          detail={currentMonthLabel}
          onPress={() => setSelectedInsightKey('currentMonth')}
        />
        <SummaryCard
          icon="calendar-number-outline"
          label="Próximo mês"
          value={formatCurrency(nextMonthTotals.total)}
          detail={nextMonthLabel}
          onPress={() => setSelectedInsightKey('nextMonth')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hoje</Text>
        <MetricRow
          label="Faturamento diário"
          value={formatCurrency(todayTotals.total)}
          detail={`${todayAppointments.length} agendamento(s)`}
          onPress={() => setSelectedInsightKey('today')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Este mês</Text>
        <MetricRow
          label="Planejado"
          value={formatCurrency(currentMonthTotals.total)}
          detail={`${currentMonthAppointments.length} agendamento(s)`}
          onPress={() => setSelectedInsightKey('currentMonth')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Próximo mês</Text>
        <MetricRow
          label="Planejado"
          value={formatCurrency(nextMonthTotals.total)}
          detail={`${nextMonthAppointments.length} agendamento(s)`}
          onPress={() => setSelectedInsightKey('nextMonth')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recebimentos</Text>
        <MetricRow
          label="Sinais pagos"
          value={formatCurrency(periodTotals.deposit)}
          detail="Mês atual + próximo"
          onPress={() => setSelectedInsightKey('receivables')}
        />
        <View style={styles.divider} />
        <MetricRow
          label="Falta pagar"
          value={formatCurrency(periodTotals.remaining)}
          detail="Mês atual + próximo"
          onPress={() => setSelectedInsightKey('receivables')}
        />
      </View>

      <InsightModal
        insight={selectedInsight}
        onClose={() => setSelectedInsightKey(null)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.darkGray,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 18,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  errorIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.08)',
  },
  errorTextArea: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  errorText: {
    marginTop: 2,
    fontSize: 12,
    color: colors.darkGray,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    minHeight: 128,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    position: 'relative',
  },
  summaryCardPrimary: {
    minHeight: 138,
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(165, 133, 102, 0.12)',
    marginBottom: 12,
  },
  summaryIconPrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  summaryChevron: {
    position: 'absolute',
    top: 14,
    right: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkGray,
    textTransform: 'uppercase',
  },
  summaryLabelPrimary: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  summaryValuePrimary: {
    fontSize: 28,
    color: colors.white,
  },
  summaryDetail: {
    marginTop: 6,
    fontSize: 12,
    color: colors.darkGray,
    textTransform: 'capitalize',
  },
  summaryDetailPrimary: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  section: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricTextArea: {
    flex: 1,
  },
  metricValueArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  metricDetail: {
    marginTop: 3,
    fontSize: 12,
    color: colors.darkGray,
    textTransform: 'capitalize',
  },
  metricValue: {
    flexShrink: 0,
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalContent: {
    maxHeight: '88%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  modalTitleArea: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: colors.darkGray,
    textTransform: 'capitalize',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  detailMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  detailMetric: {
    width: '50%',
    padding: 12,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  detailMetricLabel: {
    fontSize: 12,
    color: colors.darkGray,
    marginBottom: 4,
  },
  detailMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  decisionBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  decisionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  decisionText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.darkGray,
    marginTop: 3,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  modalEmptyText: {
    fontSize: 13,
    color: colors.darkGray,
    paddingVertical: 12,
  },
  moreAppointmentsText: {
    fontSize: 12,
    color: colors.darkGray,
    paddingTop: 8,
    paddingBottom: 4,
  },
  appointmentRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  appointmentClient: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  appointmentDate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  appointmentService: {
    marginTop: 3,
    fontSize: 13,
    color: colors.darkGray,
  },
  appointmentFinanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  appointmentFinanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  appointmentStatus: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
    color: colors.darkGray,
  },
});

export default FinancaScreen;
