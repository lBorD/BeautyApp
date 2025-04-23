import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { getClients } from '../../services/private/listClient';
import Button from '../../components/button';
import colors from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';

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
      console.log("✅ Clientes recebidos");

      setClients(clientList);
    } catch (error) {
      console.error("❌ Erro ao buscar clientes:", error);
      Alert.alert('Erro', 'Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleEditClient = (client) => {
    navigation.navigate('EditClient', { client });
  };

  const renderClientItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.clientInfo}>
        <Text style={styles.title}>Nome: {item.name} {item.lastName}</Text>
        <Text>Telefone: {item.phone}</Text>
        <Text>Email: {item.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => handleEditClient(item)}
      >
        <Ionicons name="pencil" size={24} color={colors.primary} />
      </TouchableOpacity>
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
    paddingTop: 50
  },
  offlineText: {
    textAlign: 'center',
    color: 'red',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  item: {
    backgroundColor: colors.white,
    padding: 20,
    marginVertical: 8,
    borderRadius: 8,
    borderColor: colors.shadow,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  clientInfo: {
    flex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  button: {
    alignSelf: 'center',
    marginVertical: 10,
  },
  editButton: {
    padding: 8,
  }
});

export default ClientScreen;
