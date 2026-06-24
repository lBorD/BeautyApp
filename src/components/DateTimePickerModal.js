import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../constants/colors';

const isValidDate = (date) => date instanceof Date && !isNaN(date.getTime());

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
  onCancel,
  onConfirm,
}) => {
  const insets = useSafeAreaInsets();
  const [draftValue, setDraftValue] = useState(() => (isValidDate(value) ? value : new Date()));
  const safeValue = isValidDate(value) ? value : draftValue;
  const safeValueTime = safeValue.getTime();
  const resolvedIosDisplay = iosDisplay || (mode === 'time' ? 'spinner' : 'inline');

  useEffect(() => {
    if (visible) {
      setDraftValue(new Date(safeValueTime));
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

  if (Platform.OS !== 'ios') {
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
              resolvedIosDisplay === 'spinner' && styles.spinnerPickerCard,
            ]}
          >
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
});

export default DateTimePickerModal;
