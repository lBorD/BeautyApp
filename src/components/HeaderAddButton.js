import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

const HeaderAddButton = ({ onPress, accessibilityLabel = 'Adicionar' }) => (
  <TouchableOpacity
    style={styles.button}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
  >
    <Ionicons name="add-circle" size={40} color={colors.primary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    padding: 5,
  },
});

export default HeaderAddButton;
