import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, RefreshControl, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editedClient, setEditedClient] = useState({
    name: '',
    lastName: '',
    phone: '',
    email: '',
    birthDate: new Date(),
    address: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);


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
    setSelectedClient(client);
    setEditedClient({
      name: client.name || '',
      lastName: client.lastName || '',
      phone: client.phone || '',
      email: client.email || '',
      birthDate: client.birthDate ? new Date(client.birthDate) : new Date(),
      address: client.address || ''
    });
    setModalVisible(true);
  };

  const handleSaveChanges = async () => {
    if (!isConnected) {
      Alert.alert('Sem Conexão', 'Você está offline. Conecte-se à internet para salvar as alterações.');
      return;
    }

    try {
      // Here you would call your API to update the client
      // Example: await updateClient(selectedClient.id, editedClient);

      // For now, let's just update the local state
      const updatedClients = clients.map(client =>
        client.id === selectedClient.id ? { ...client, ...editedClient } : client
      );

      setClients(updatedClients);
      setModalVisible(false);
      Alert.alert('Sucesso', 'Cliente atualizado com sucesso!');
    } catch (error) {
      console.error("❌ Erro ao atualizar cliente:", error);
      Alert.alert('Erro', 'Não foi possível atualizar o cliente.');
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setEditedClient({ ...editedClient, birthDate: selectedDate });
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
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

      {/* Edit Client Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Editar Cliente</Text>

              <Text style={styles.inputLabel}>Nome</Text>
              <TextInput
                style={styles.input}
                value={editedClient.name}
                onChangeText={(text) => setEditedClient({ ...editedClient, name: text })}
                placeholder="Nome"
              />

              <Text style={styles.inputLabel}>Sobrenome</Text>
              <TextInput
                style={styles.input}
                value={editedClient.lastName}
                onChangeText={(text) => setEditedClient({ ...editedClient, lastName: text })}
                placeholder="Sobrenome"
              />

              <Text style={styles.inputLabel}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={editedClient.phone}
                onChangeText={(text) => setEditedClient({ ...editedClient, phone: text })}
                placeholder="Telefone"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={editedClient.email}
                onChangeText={(text) => setEditedClient({ ...editedClient, email: text })}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Data de Nascimento</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text>{formatDate(editedClient.birthDate)}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={editedClient.birthDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}

              <Text style={styles.inputLabel}>Endereço</Text>
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={editedClient.address}
                onChangeText={(text) => setEditedClient({ ...editedClient, address: text })}
                placeholder="Endereço"
                multiline
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveChanges}
                >
                  <Text style={styles.buttonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: colors.primary,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.shadow,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    backgroundColor: colors.white,
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: colors.shadow,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    backgroundColor: colors.white,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    padding: 12,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.shadow,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
  },

});

export default ClientScreen;
