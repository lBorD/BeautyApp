import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { getClients } from '../../services/private/listClient';
import Button from '../../components/button';
import { differenceInYears, parseISO } from 'date-fns';

const ClientScreen = () => {
  const navigation = useNavigation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    fetchClients();

    return () => unsubscribe();
  }, []);

  const fetchClients = async () => {
    if (!isConnected) {
      Alert.alert('Sem Conexão', 'Você está offline. Conecte-se à internet para atualizar os clientes.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setRefreshing(true);
      console.log("🔄 Buscando clientes da API...");

      const clientList = await getClients();
      console.log("✅ Clientes recebidos:", clientList);

      setClients(clientList);
    } catch (error) {
      console.error("❌ Erro ao buscar clientes:", error);
      Alert.alert('Erro', 'Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return "Not provided";
    const birth = parseISO(birthDate);
    const today = new Date();
    let age = differenceInYears(today, birth);
    return `${age} years`;
  };

  const renderClientItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.title}>ID: {item.id}</Text>
      <Text>Name: {item.name} {item.lastName}</Text>
      <Text>Phone: {item.phone}</Text>
      <Text>Email: {item.email}</Text>
      <Text>Age: {calculateAge(item.birthDate)}</Text>
    </View>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#0000ff" />;

  return (
    <View style={styles.container}>
      {!isConnected && <Text style={styles.offlineText}>You are offline</Text>}

      <FlatList
        data={clients}
        renderItem={renderClientItem}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchClients} />
        }
      />

      <Button style={styles.button}
        title="Register Client"
        onPress={() => navigation.navigate('RegisterCustomer')}
        icon="plus"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 50,
  },
  offlineText: {
    textAlign: 'center',
    color: 'red',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  item: {
    backgroundColor: '#f9c2ff',
    padding: 20,
    marginVertical: 8,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  button: {
    alignSelf: 'center',
    marginVertical: 10,
  },
});

export default ClientScreen;
