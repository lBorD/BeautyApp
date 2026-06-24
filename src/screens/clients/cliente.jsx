import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, RefreshControl, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { getClients, removeClientLocally } from '../../services/private/listClient';
import DateTimePickerModal from '../../components/DateTimePickerModal';
import FeedbackModal from '../../components/FeedbackModal';
import HeaderAddButton from '../../components/HeaderAddButton';
import SearchInput from '../../components/SearchInput';
import colors from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { isSessionExpiredError } from '../../services/sessionManager';
import { validateFormData } from '../../utils/validations';
import { formatDate } from '../../utils/formatBirthday';
import useFeedbackModal from '../../hooks/useFeedbackModal';

const ClientScreen = () => {
  const navigation = useNavigation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClients, setFilteredClients] = useState([]);
  const { feedback, showFeedback, hideFeedback } = useFeedbackModal();
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
      if (!isSessionExpiredError(error)) {
        showFeedback({
          type: 'error',
          title: 'Erro',
          message: 'Não foi possível carregar os clientes.',
        });
      }
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
        email: editedClient.email.trim() || null,
        birthDate: formatDate(editedClient.birthDate)
      };

      if (!validateFormData(clientToUpdate)) {
        return;
      }

      console.log("🔄 Atualizando cliente na API...");
      const response = await api.patch(`/clients/update/${selectedClient.id}`, clientToUpdate);

      if (response.status === 200) {
        const updatedClients = clients.map(client =>
          client.id === selectedClient.id ? { ...client, ...editedClient } : client
        );

        setClients(updatedClients);
        setModalVisible(false);
        showFeedback({
          type: 'success',
          title: 'Sucesso',
          message: 'Cliente atualizado com sucesso!',
        });
      } else {
        showFeedback({
          type: 'error',
          title: 'Erro',
          message: response.data.message || 'Não foi possível atualizar o cliente.',
        });
      }
    } catch (error) {
      console.error("❌ Erro ao atualizar cliente:", error.response?.data || error.message);
      showFeedback({
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível atualizar o cliente.',
      });
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

              showFeedback({
                type: 'success',
                title: 'Sucesso',
                message: 'Cliente excluído com sucesso!',
              });
            } catch (error) {
              console.error("❌ Erro ao excluir cliente:", error);
              showFeedback({
                type: 'error',
                title: 'Erro',
                message: 'Não foi possível excluir o cliente.',
              });
            }
          }
        }
      ]
    );
  };

  const handleDateConfirm = (selectedDate) => {
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
        {item.email ? <Text>Email: {item.email}</Text> : null}
      </View>
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => handleEditClient(item)}
      >
        <Ionicons name="pencil" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Clientes</Text>
        <HeaderAddButton
          accessibilityLabel="Novo Cliente"
          onPress={() => navigation.navigate('RegisterCustomer')}
        />
      </View>

      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar cliente..."
        />
      </View>

      <View style={styles.listArea}>
        <FlatList
          data={filteredClients}
          renderItem={renderClientItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchClients} />
          }
        />
      </View>

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
                  <Ionicons name="trash-outline" size={24} color={colors.secondary} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                mode="outlined"
                label="Nome *"
                value={editedClient.name}
                onChangeText={(text) => setEditedClient({ ...editedClient, name: text })}
              />

              <TextInput
                style={styles.input}
                mode="outlined"
                label="Sobrenome"
                value={editedClient.lastName}
                onChangeText={(text) => setEditedClient({ ...editedClient, lastName: text })}
              />

              <TextInput
                style={styles.input}
                mode="outlined"
                label="Telefone *"
                value={editedClient.phone}
                onChangeText={(text) => setEditedClient({ ...editedClient, phone: text })}
                keyboardType="phone-pad"
              />

              <TextInput
                style={styles.input}
                mode="outlined"
                label="Email (opcional)"
                value={editedClient.email}
                onChangeText={(text) => setEditedClient({ ...editedClient, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowDatePicker(true)}
              >
                <TextInput
                  style={styles.input}
                  mode="outlined"
                  label="Data de Nascimento *"
                  editable={false}
                  value={formatDate(editedClient.birthDate)}
                  right={<TextInput.Icon icon="calendar" onPress={() => setShowDatePicker(true)} />}
                  pointerEvents="none"
                />
              </TouchableOpacity>

              <TextInput
                style={[styles.input, styles.addressInput]}
                mode="outlined"
                label="Endereço"
                value={editedClient.address}
                onChangeText={(text) => setEditedClient({ ...editedClient, address: text })}
                multiline
              />

              <Text style={styles.helperText}>* Campos obrigatórios</Text>

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

      <DateTimePickerModal
        visible={showDatePicker}
        value={editedClient.birthDate || new Date()}
        mode="date"
        title="Data de nascimento"
        iosDisplay="spinner"
        onCancel={() => setShowDatePicker(false)}
        onConfirm={handleDateConfirm}
      />

      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        buttonText={feedback.buttonText}
        onClose={hideFeedback}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  listArea: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  editButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
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
  input: {
    height: 50,
    marginBottom: 5,
    fontSize: 16,
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    color: colors.darkGray,
    fontSize: 12,
    marginBottom: 20,
    marginLeft: 5,
    fontStyle: 'italic',
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
