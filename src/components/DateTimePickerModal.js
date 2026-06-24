import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../constants/colors';

const isValidDate = (date) => date instanceof Date && !isNaN(date.getTime());

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const HOURS = Array.from({ length: 24 }, (_, index) => index);

const getMonthMatrix = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return day;
  });
};

const isSameDay = (firstDate, secondDate) => (
  firstDate.getFullYear() === secondDate.getFullYear()
  && firstDate.getMonth() === secondDate.getMonth()
  && firstDate.getDate() === secondDate.getDate()
);

const isBeforeMinDate = (date, minimumDate) => {
  if (!isValidDate(minimumDate)) {
    return false;
  }

  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const minimum = new Date(minimumDate);
  minimum.setHours(0, 0, 0, 0);
  return current < minimum;
};

const isAfterMaxDate = (date, maximumDate) => {
  if (!isValidDate(maximumDate)) {
    return false;
  }

  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const maximum = new Date(maximumDate);
  maximum.setHours(0, 0, 0, 0);
  return current > maximum;
};

const clampDate = (date, minimumDate, maximumDate) => {
  if (isValidDate(minimumDate) && date < minimumDate) {
    return new Date(minimumDate);
  }

  if (isValidDate(maximumDate) && date > maximumDate) {
    return new Date(maximumDate);
  }

  return date;
};

const formatNumber = (value) => String(value).padStart(2, '0');

const DateTimePickerModal = ({
  visible,
  value,
  mode = 'date',
  title = 'Selecionar',
  cancelText = 'Cancelar',
  confirmText = 'Concluir',
  iosDisplay,
  minimumDate,
  maximumDate,
  minuteInterval,
  useAppPicker = false,
  onCancel,
  onConfirm,
}) => {
  const insets = useSafeAreaInsets();
  const [draftValue, setDraftValue] = useState(() => (isValidDate(value) ? value : new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = isValidDate(value) ? value : new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const safeValue = isValidDate(value) ? value : draftValue;
  const safeValueTime = safeValue.getTime();
  const resolvedIosDisplay = iosDisplay || (mode === 'time' ? 'spinner' : 'inline');
  const monthDays = useMemo(() => getMonthMatrix(visibleMonth), [visibleMonth]);
  const minuteOptions = useMemo(() => {
    const interval = Number(minuteInterval || 5);
    const safeInterval = interval > 0 && interval <= 30 ? interval : 5;
    return Array.from({ length: Math.floor(60 / safeInterval) }, (_, index) => index * safeInterval);
  }, [minuteInterval]);

  useEffect(() => {
    if (visible) {
      const nextValue = new Date(safeValueTime);
      setDraftValue(nextValue);
      setVisibleMonth(new Date(nextValue.getFullYear(), nextValue.getMonth(), 1));
    }
  }, [safeValueTime, visible]);

  if (!visible) {
    return null;
  }

  const handleAndroidChange = (event, selectedDate) => {
    if (event?.type === 'dismissed' || !selectedDate) {
      onCancel?.();
      return;
    }

    onConfirm?.(selectedDate);
  };

  if (!useAppPicker && Platform.OS !== 'ios') {
    return (
      <DateTimePicker
        value={safeValue}
        mode={mode}
        display="default"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        minuteInterval={minuteInterval}
        onChange={handleAndroidChange}
      />
    );
  }

  const setDraftDate = (selectedDate) => {
    setDraftValue((previousValue) => {
      const nextValue = new Date(previousValue);
      nextValue.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      return clampDate(nextValue, minimumDate, maximumDate);
    });
  };

  const setDraftTime = (unit, selectedValue) => {
    setDraftValue((previousValue) => {
      const nextValue = new Date(previousValue);
      if (unit === 'hour') {
        nextValue.setHours(selectedValue);
      } else {
        nextValue.setMinutes(selectedValue);
      }
      nextValue.setSeconds(0, 0);
      return nextValue;
    });
  };

  const changeMonth = (direction) => {
    setVisibleMonth((previousMonth) => {
      const nextMonth = new Date(previousMonth);
      nextMonth.setMonth(previousMonth.getMonth() + direction);
      return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    });
  };

  const changeYear = (direction) => {
    setVisibleMonth((previousMonth) => {
      const nextMonth = new Date(previousMonth);
      nextMonth.setFullYear(previousMonth.getFullYear() + direction);
      return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    });
  };

  const renderAppDatePicker = () => (
    <View style={styles.appPicker}>
      <View style={styles.calendarNavigation}>
        <TouchableOpacity style={styles.navigationButton} onPress={() => changeYear(-1)}>
          <Text style={styles.navigationButtonText}>‹‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navigationButton} onPress={() => changeMonth(-1)}>
          <Text style={styles.navigationButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.monthTitleArea}>
          <Text style={styles.monthTitle}>{MONTH_LABELS[visibleMonth.getMonth()]}</Text>
          <Text style={styles.yearTitle}>{visibleMonth.getFullYear()}</Text>
        </View>
        <TouchableOpacity style={styles.navigationButton} onPress={() => changeMonth(1)}>
          <Text style={styles.navigationButtonText}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navigationButton} onPress={() => changeYear(1)}>
          <Text style={styles.navigationButtonText}>››</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekdaysRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekdayText}>{label}</Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {monthDays.map((day) => {
          const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
          const isSelected = isSameDay(day, draftValue);
          const isDisabled = isBeforeMinDate(day, minimumDate) || isAfterMaxDate(day, maximumDate);

          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                isDisabled && styles.dayCellDisabled,
              ]}
              disabled={isDisabled}
              onPress={() => setDraftDate(day)}
            >
              <Text
                style={[
                  styles.dayText,
                  !isCurrentMonth && styles.dayTextMuted,
                  isSelected && styles.dayTextSelected,
                  isDisabled && styles.dayTextDisabled,
                ]}
              >
                {day.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderTimeColumn = (items, selectedValue, unit) => (
    <ScrollView
      style={styles.timeColumn}
      contentContainerStyle={styles.timeColumnContent}
      showsVerticalScrollIndicator={false}
    >
      {items.map((item) => {
        const isSelected = item === selectedValue;
        return (
          <TouchableOpacity
            key={`${unit}-${item}`}
            style={[styles.timeOption, isSelected && styles.timeOptionSelected]}
            onPress={() => setDraftTime(unit, item)}
          >
            <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextSelected]}>
              {formatNumber(item)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderAppTimePicker = () => (
    <View style={styles.timePicker}>
      <View style={styles.timeColumnHeader}>
        <Text style={styles.timeColumnTitle}>Hora</Text>
        <Text style={styles.timeSeparator}>:</Text>
        <Text style={styles.timeColumnTitle}>Minuto</Text>
      </View>
      <View style={styles.timeColumnsRow}>
        {renderTimeColumn(HOURS, draftValue.getHours(), 'hour')}
        <Text style={styles.timeSeparatorLarge}>:</Text>
        {renderTimeColumn(minuteOptions, draftValue.getMinutes(), 'minute')}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdropPressable}
          activeOpacity={1}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Fechar seletor"
        />

        <View style={[styles.sheet, { paddingBottom: 18 + Math.max(insets.bottom, 6) }]}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} hitSlop={10}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>

            <Text style={styles.title}>{title}</Text>

            <TouchableOpacity
              onPress={() => onConfirm?.(draftValue)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.pickerCard,
              (resolvedIosDisplay === 'spinner' || useAppPicker) && styles.spinnerPickerCard,
            ]}
          >
            {useAppPicker ? (
              mode === 'time' ? renderAppTimePicker() : renderAppDatePicker()
            ) : (
              <DateTimePicker
                value={draftValue}
                mode={mode}
                display={resolvedIosDisplay}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                minuteInterval={minuteInterval}
                onChange={(_event, selectedDate) => {
                  if (selectedDate) {
                    setDraftValue(selectedDate);
                  }
                }}
                style={[
                  styles.iosPicker,
                  resolvedIosDisplay === 'spinner' && styles.spinnerPicker,
                ]}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  header: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  cancelText: {
    color: colors.darkGray,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '800',
  },
  pickerCard: {
    marginTop: 6,
    borderRadius: 18,
    backgroundColor: colors.white,
    overflow: 'hidden',
    alignItems: 'center',
  },
  spinnerPickerCard: {
    backgroundColor: colors.inputBackground,
  },
  iosPicker: {
    width: '100%',
    minHeight: 330,
  },
  spinnerPicker: {
    height: 216,
    minHeight: 216,
  },
  appPicker: {
    width: '100%',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 10,
  },
  calendarNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  navigationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navigationButtonText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  monthTitleArea: {
    flex: 1,
    alignItems: 'center',
  },
  monthTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  yearTitle: {
    marginTop: 2,
    color: colors.darkGray,
    fontSize: 13,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: colors.darkGray,
    fontSize: 12,
    fontWeight: '800',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellDisabled: {
    opacity: 0.35,
  },
  dayText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dayTextMuted: {
    color: colors.lightGray,
  },
  dayTextSelected: {
    color: colors.white,
  },
  dayTextDisabled: {
    color: colors.darkGray,
  },
  timePicker: {
    width: '100%',
    paddingTop: 6,
    paddingBottom: 12,
  },
  timeColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  timeColumnTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.darkGray,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timeSeparator: {
    width: 28,
    textAlign: 'center',
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  timeColumnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  timeColumn: {
    flex: 1,
    maxHeight: 220,
  },
  timeColumnContent: {
    gap: 8,
    paddingVertical: 4,
  },
  timeOption: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeOptionText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  timeOptionTextSelected: {
    color: colors.white,
  },
  timeSeparatorLarge: {
    width: 28,
    textAlign: 'center',
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
});

export default DateTimePickerModal;
