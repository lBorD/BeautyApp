import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Button from '../components/button';

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
      <FlatList
        data={clientes}
        renderItem={renderItem}
        keyExtractor={item => item.id}
      />
      <Button style={styles.button}
        title="Exibir Clientes"
        onPress={() => navigation.goBack()}
      />
      <Button style={styles.button}
        title="Cadastrar Cliente"
        onPress={() => navigation.navigate('CadastrarCliente')}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    allignItems: 'flex',
    padding: 16,
    paddingTop: 50,
  },
  item: {
    backgroundColor: '#f9c2ff',
    padding: 20,
    marginVertical: 8,
  },
  title: {
    fontSize: 24,
  },
  button: {
    alignSelf: 'center',
  },
});

export default ClienteScreen;