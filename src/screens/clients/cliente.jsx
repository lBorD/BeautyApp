import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, RefreshControl, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { getClients, removeClientLocally } from '../../services/private/listClient';
import Button from '../../components/button';
import colors from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { validations } from '../../utils/validations';
import { formatDate } from '../../utils/formatBirthday';
import validator from 'validator';

const ClientScreen = () => {
  const navigation = useNavigation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClients, setFilteredClients] = useState([]);
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
    fetchClients();
  }, []);
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClients(clients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = clients.filter(client =>
      (client.name?.toLowerCase().includes(query) ||
        client.lastName?.toLowerCase().includes(query) ||
        client.phone?.includes(query) ||
        client.email?.toLowerCase().includes(query))
      );
      setFilteredClients(filtered);
    }

  }, [searchQuery, clients]);

  const fetchClients = async () => {
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
    try {

      const clientToUpdate = {
        ...editedClient,
        birthDate: formatDate(editedClient.birthDate)
      };

      const validations = [
        { condition: !clientToUpdate.email, message: "É necessário fornecer o e-mail para finalizar o registro." },
        { condition: !clientToUpdate.name, message: "É necessário fornecer o nome para finalizar o registro." },
        { condition: !clientToUpdate.phone, message: "É necessário fornecer o número de telefone para finalizar o registro." },
        { condition: !clientToUpdate.birthDate, message: "É necessário fornecer a data de nascimento para finalizar o registro." },
        { condition: !validator.isEmail(clientToUpdate.email), message: "E-mail inválido." },
        { condition: !validator.isDate(clientToUpdate.birthDate, { format: 'YYYY-MM-DD', strictMode: true }), message: "Data de nascimento inválida. Use o formato YYYY-MM-DD." },
        // { condition: new Date(editedClient.birthDate.split('/').reverse().join('-')) > new Date(), message: "Data de nascimento não pode ser no futuro." }
      ];

      const error = validations.find(v => v.condition);
      if (error) {
        Alert.alert("Erro", error.message);
        return;
      }

      console.log("🔄 Atualizando cliente na API...");
      const response = await api.patch(`/clients/update/${selectedClient.id}`, clientToUpdate);

      if (response.status === 200) {
        const updatedClients = clients.map(client =>
          client.id === selectedClient.id ? { ...client, ...editedClient } : client
        );

        setClients(updatedClients);
        Alert.alert('Sucesso', 'Cliente atualizado com sucesso!');
        setModalVisible(false);
      } else {
        Alert.alert('Erro', 'Não foi possível atualizar o cliente.');
      }
    } catch (error) {
      console.error("❌ Erro ao atualizar cliente:", error.response?.data || error.message);
      Alert.alert('Erro', 'Não foi possível atualizar o cliente.');
    }
  };

  const handleDeleteClient = (client) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o cliente ${client.name} ${client.lastName || ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/clients/delete/${client.id}`);
              await removeClientLocally(client.id);
              fetchClients();

              const updatedClients = clients.filter(c => c.id !== client.id);
              setClients(updatedClients);

              Alert.alert('Sucesso', 'Cliente excluído com sucesso!');
            } catch (error) {
              console.error("❌ Erro ao excluir cliente:", error);
              Alert.alert('Erro', 'Não foi possível excluir o cliente.');
            }
          }
        }
      ]
    );
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setEditedClient({ ...editedClient, birthDate: selectedDate });
    }
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
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.text} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredClients}
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

      {/* MODAL DE EDIÇÃO DE CLIENTE */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Cliente</Text>
                <TouchableOpacity
                  style={styles.deleteIconButton}
                  onPress={() => {
                    setModalVisible(false);
                    setTimeout(() => {
                      handleDeleteClient(selectedClient);
                    }, 300);
                  }}
                >
                  <Ionicons name="trash-outline" size={24} color={colors.danger} />
                </TouchableOpacity>
              </View>
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 18,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    backgroundColor: colors.secondary,
  },
  deleteIconButton: {
    padding: 5,
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
  },

});

export default ClientScreen;
