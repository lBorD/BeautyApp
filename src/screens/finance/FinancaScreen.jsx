import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../../constants/colors';

const KPI_ITEMS = [
  { label: 'Faturamento do mês', value: 'R$ 0,00' },
  { label: 'Sinais recebidos', value: 'R$ 0,00' },
  { label: 'Total pendente', value: 'R$ 0,00' },
];

const FinancaScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Financeiro</Text>
      {KPI_ITEMS.map((item) => (
        <View key={item.label} style={styles.card}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 6,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
});

export default FinancaScreen;
