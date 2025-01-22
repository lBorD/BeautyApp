import React from 'react';
import { View, Text, Button, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const ClienteScreen = () => {
  const navigation = useNavigation();

  const clientes = [
    { id: '1', nome: 'Cliente 1', idade: 25, ticketMedio: 100 },
    { id: '2', nome: 'Cliente 2', idade: 30, ticketMedio: 150 },
    { id: '3', nome: 'Cliente 3', idade: 22, ticketMedio: 200 },
  ];

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.title}>Nome: {item.nome}</Text>
      <Text>Idade: {item.idade}</Text>
      <Text>Ticket Médio: {item.ticketMedio}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Button
        title="Cadastrar Cliente"
        onPress={() => navigation.navigate('CadastrarCliente')}
      />
      <FlatList
        data={clientes}
        renderItem={renderItem}
        keyExtractor={item => item.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  item: {
    backgroundColor: '#f9c2ff',
    padding: 20,
    marginVertical: 8,
  },
  title: {
    fontSize: 24,
  },
});

export default ClienteScreen;