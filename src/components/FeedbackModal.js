import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

const feedbackConfig = {
  success: {
    icon: 'checkmark-circle',
    color: colors.primary,
    title: 'Tudo certo',
  },
  error: {
    icon: 'alert-circle',
    color: colors.secondary,
    title: 'Algo deu errado',
  },
};

const FeedbackModal = ({
  visible,
  type = 'success',
  title,
  message,
  buttonText = 'OK',
  onClose,
}) => {
  const feedback = feedbackConfig[type] || feedbackConfig.success;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { borderTopColor: feedback.color }]}>
          <View style={[styles.iconWrapper, { borderColor: feedback.color }]}>
            <Ionicons name={feedback.icon} size={34} color={feedback.color} />
          </View>

          <Text style={styles.title}>{title || feedback.title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={buttonText}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderTopWidth: 5,
    padding: 22,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  iconWrapper: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.darkGray,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    minWidth: 120,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FeedbackModal;
