import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const SettingsScreen = () => {
  const navigation = useNavigation<any>();
  const handleLogout = () => {
    console.log('User logged out');

    navigation.navigate('Auth');
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