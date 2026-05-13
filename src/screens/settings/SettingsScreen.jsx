import React from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { logout } from '../../services/sessionManager';

const SettingsScreen = () => {
  const handleLogout = async () => {
    try {
      await logout({ reason: 'manual' });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      Alert.alert('Erro', 'Não foi possível sair agora. Tente novamente.');
    }
  };

  return (
    <View style={styles.container}>
      <Text>Configurações</Text>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SettingsScreen;