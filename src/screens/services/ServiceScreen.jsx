import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, RefreshControl, TouchableOpacity, Modal, TextInput as RNTextInput, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { listServices, deleteService } from '../../services/private/serviceAPI';
import Button from '../../components/button';
import colors from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';

const ServiceScreen = () => {
  const navigation = useNavigation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState([]);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredServices(services);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = services.filter(service =>
        service.name?.toLowerCase().includes(query)
      );
      setFilteredServices(filtered);
    }
  }, [searchQuery, services]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const data = await listServices({ active: true, page: 1, limit: 100 });
      setServices(data.services || []);
      setFilteredServices(data.services || []);
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
      Alert.alert('Erro', 'Não foi possível carregar os serviços');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchServices();
  };

  const handleServicePress = (service) => {
    setSelectedService(service);
    setModalVisible(true);
  };

  const handleEditService = (service) => {
    setModalVisible(false);
    navigation.navigate('EditService', { 
      service,
      onUpdate: fetchServices
    });
  };

  const handleDeleteService = async (id) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Deseja realmente excluir este serviço?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteService(id);
              Alert.alert('Sucesso', 'Serviço excluído com sucesso');
              setModalVisible(false);
              fetchServices();
            } catch (error) {
              console.error('Erro ao excluir serviço:', error);
              Alert.alert('Erro', 'Não foi possível excluir o serviço');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value) => {
    return parseFloat(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const renderServiceItem = ({ item }) => (
    <TouchableOpacity
      style={styles.serviceCard}
      onPress={() => handleServicePress(item)}
    >
      <View style={styles.serviceHeader}>
        <Text style={styles.serviceName}>{item.name}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.servicePrice}>{formatCurrency(item.price)}</Text>
        </View>
      </View>
      <View style={styles.serviceDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color={colors.darkGray} />
          <Text style={styles.detailText}>{item.estimatedTime} min</Text>
        </View>
        {item.cost > 0 && (
          <View style={styles.detailItem}>
            <Ionicons name="cash-outline" size={16} color={colors.darkGray} />
            <Text style={styles.detailText}>Custo: {formatCurrency(item.cost)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Serviços</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('RegisterService')}
        >
          <Ionicons name="add-circle" size={40} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          mode="outlined"
          placeholder="Buscar serviço..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          left={<TextInput.Icon icon="magnify" />}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderServiceItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={64} color={colors.lightGray} />
              <Text style={styles.emptyText}>Nenhum serviço cadastrado</Text>
            </View>
          }
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {selectedService && (
                <>
                  <Text style={styles.modalTitle}>{selectedService.name}</Text>

                  <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                      <Ionicons name="cash" size={20} color={colors.primary} />
                      <Text style={styles.infoLabel}>Preço:</Text>
                      <Text style={styles.infoValue}>{formatCurrency(selectedService.price)}</Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Ionicons name="time" size={20} color={colors.primary} />
                      <Text style={styles.infoLabel}>Tempo:</Text>
                      <Text style={styles.infoValue}>{selectedService.estimatedTime} minutos</Text>
                    </View>

                    {selectedService.cost > 0 && (
                      <View style={styles.infoRow}>
                        <Ionicons name="trending-down" size={20} color={colors.warning} />
                        <Text style={styles.infoLabel}>Custo:</Text>
                        <Text style={styles.infoValue}>{formatCurrency(selectedService.cost)}</Text>
                      </View>
                    )}

                    <View style={styles.infoRow}>
                      <Ionicons name="trending-up" size={20} color={colors.success} />
                      <Text style={styles.infoLabel}>Lucro:</Text>
                      <Text style={[styles.infoValue, { color: colors.success }]}>
                        {formatCurrency(selectedService.price - (selectedService.cost || 0))}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalButtons}>
                    <Button
                      title="Editar"
                      onPress={() => handleEditService(selectedService)}
                      style={{ backgroundColor: colors.primary }}
                    />
                    <Button
                      title="Excluir"
                      onPress={() => handleDeleteService(selectedService.id)}
                      style={{ backgroundColor: colors.error }}
                    />
                    <Button
                      title="Fechar"
                      onPress={() => setModalVisible(false)}
                    />
                  </View>
                </>
              )}
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
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  addButton: {
    padding: 5,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: colors.white,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  serviceCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  priceContainer: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  serviceDetails: {
    flexDirection: 'row',
    gap: 15,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    fontSize: 14,
    color: colors.darkGray,
  },
  loader: {
    marginTop: 50,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: colors.darkGray,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  infoLabel: {
    fontSize: 16,
    color: colors.darkGray,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalButtons: {
    marginTop: 10,
  },
});

export default ServiceScreen;
