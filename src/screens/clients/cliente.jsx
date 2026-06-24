import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getClients, removeClientLocally } from '../../services/private/listClient';
import FeedbackModal from '../../components/FeedbackModal';
import HeaderAddButton from '../../components/HeaderAddButton';
import SearchInput from '../../components/SearchInput';
import colors from '../../constants/colors';
import api from '../../services/api';
import { isSessionExpiredError } from '../../services/sessionManager';
import formatPhoneNumber from '../../utils/formatNumber';
import { validateFormData } from '../../utils/validations';
import { formatBirthDay, formatDate, formatDateForInput } from '../../utils/formatBirthday';
import useFeedbackModal from '../../hooks/useFeedbackModal';

const getInitialEditedClient = () => ({
  name: '',
  lastName: '',
  phone: '',
  email: '',
  birthDate: '',
  address: '',
});

const hasOptionalClientInfo = (client) => Boolean(
  client?.lastName
  || client?.email
  || client?.birthDate
  || client?.address
);

const ClientScreen = () => {
  const navigation = useNavigation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClients, setFilteredClients] = useState([]);
  const [editedClient, setEditedClient] = useState(getInitialEditedClient);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const { feedback, showFeedback, hideFeedback } = useFeedbackModal();

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClients(clients);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = clients.filter((client) => (
      client.name?.toLowerCase().includes(query)
      || client.lastName?.toLowerCase().includes(query)
      || client.phone?.includes(query)
      || client.email?.toLowerCase().includes(query)
    ));

    setFilteredClients(filtered);
  }, [searchQuery, clients]);

  const fetchClients = async () => {
    try {
      setRefreshing(true);
      console.log('Buscando clientes da API...');

      const clientList = await getClients();
      console.log('Clientes recebidos');

      setClients(clientList);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
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

  const closeEditModal = () => {
    setModalVisible(false);
    setShowOptionalFields(false);
    setSelectedClient(null);
    setEditedClient(getInitialEditedClient());
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setEditedClient({
      name: client.name || '',
      lastName: client.lastName || '',
      phone: client.phone || '',
      email: client.email || '',
      birthDate: formatDateForInput(client.birthDate),
      address: client.address || '',
    });
    setShowOptionalFields(hasOptionalClientInfo(client));
    setModalVisible(true);
  };

  const handlePhoneChange = (text) => {
    setEditedClient((previousClient) => ({
      ...previousClient,
      phone: formatPhoneNumber(text),
    }));
  };

  const handleBirthDateChange = (text) => {
    setEditedClient((previousClient) => ({
      ...previousClient,
      birthDate: formatBirthDay(text),
    }));
  };

  const buildClientPayload = () => ({
    name: editedClient.name.trim(),
    lastName: editedClient.lastName.trim(),
    phone: editedClient.phone.trim() || null,
    email: editedClient.email.trim() || null,
    birthDate: formatDate(editedClient.birthDate),
    address: editedClient.address.trim(),
  });

  const handleSaveChanges = async () => {
    try {
      const clientToUpdate = buildClientPayload();

      if (!validateFormData(clientToUpdate)) {
        return;
      }

      console.log('Atualizando cliente na API...');
      const response = await api.patch(`/clients/update/${selectedClient.id}`, clientToUpdate);

      if (response.status === 200) {
        const updatedClient = response.data;
        const updatedClients = clients.map((client) => (
          client.id === selectedClient.id ? { ...client, ...updatedClient } : client
        ));

        setClients(updatedClients);
        closeEditModal();
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
      console.error('Erro ao atualizar cliente:', error.response?.data || error.message);
      showFeedback({
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível atualizar o cliente.',
      });
    }
  };

  const handleDeleteClient = (client) => {
    Alert.alert(
      'Confirmar exclusão',
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

              const updatedClients = clients.filter((currentClient) => currentClient.id !== client.id);
              setClients(updatedClients);

              showFeedback({
                type: 'success',
                title: 'Sucesso',
                message: 'Cliente excluído com sucesso!',
              });
            } catch (error) {
              console.error('Erro ao excluir cliente:', error);
              showFeedback({
                type: 'error',
                title: 'Erro',
                message: 'Não foi possível excluir o cliente.',
              });
            }
          },
        },
      ],
    );
  };

  const renderClientItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.clientInfo}>
        <Text style={styles.title}>Nome: {item.name} {item.lastName}</Text>
        <Text>Telefone: {item.phone || 'Não informado'}</Text>
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

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;
  }

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
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={(
            <RefreshControl refreshing={refreshing} onRefresh={fetchClients} />
          )}
        />
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Cliente</Text>
                <TouchableOpacity
                  style={styles.deleteIconButton}
                  onPress={() => {
                    const clientToDelete = selectedClient;
                    closeEditModal();
                    setTimeout(() => {
                      handleDeleteClient(clientToDelete);
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
                label="Telefone"
                value={editedClient.phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={styles.optionalToggle}
                activeOpacity={0.75}
                onPress={() => setShowOptionalFields((currentValue) => !currentValue)}
              >
                <Text style={styles.optionalToggleText}>
                  {showOptionalFields ? 'Ocultar opções' : 'Mais opções'}
                </Text>
                <Text style={styles.optionalToggleIcon}>{showOptionalFields ? 'v' : '>'}</Text>
              </TouchableOpacity>

              {showOptionalFields && (
                <View style={styles.optionalFields}>
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
                    label="Email (opcional)"
                    value={editedClient.email}
                    onChangeText={(text) => setEditedClient({ ...editedClient, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TextInput
                    style={styles.input}
                    mode="outlined"
                    label="Nascimento (opcional)"
                    placeholder="09/08/1999"
                    value={editedClient.birthDate}
                    onChangeText={handleBirthDateChange}
                    keyboardType="number-pad"
                    maxLength={10}
                  />

                  <TextInput
                    style={[styles.input, styles.addressInput]}
                    mode="outlined"
                    label="Endereço"
                    value={editedClient.address}
                    onChangeText={(text) => setEditedClient({ ...editedClient, address: text })}
                    multiline
                  />
                </View>
              )}

              <Text style={styles.helperText}>* Apenas nome é obrigatório.</Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeEditModal}
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
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
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
  optionalToggle: {
    minHeight: 44,
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalToggleText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  optionalToggleIcon: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  optionalFields: {
    marginBottom: 2,
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
