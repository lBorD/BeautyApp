import React from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../constants/colors';

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

const AgendaScreen = () => {
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const handleAddAppointment = () => {
    Alert.alert('Em breve', 'Fluxo de agendamento será adicionado aqui.');
  };

  const renderItem = ({ item }) => (
    <View style={styles.slotItem}>
      <Text style={styles.slotTime}>{item}</Text>
      <Text style={styles.slotStatus}>Livre</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agenda</Text>
      <Text style={styles.dateLabel}>{today}</Text>

      <FlatList
        data={TIME_SLOTS}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
      />

      <TouchableOpacity style={styles.fab} onPress={handleAddAppointment}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
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
  },
  dateLabel: {
    marginTop: 6,
    fontSize: 16,
    color: colors.darkGray,
    textTransform: 'capitalize',
  },
  listContainer: {
    paddingVertical: 20,
    gap: 10,
    paddingBottom: 120,
  },
  slotItem: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotTime: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
  },
  slotStatus: {
    fontSize: 14,
    color: colors.darkGray,
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
});

export default AgendaScreen;
