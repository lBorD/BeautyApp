import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

const STORAGE_KEY_CLIENTS = 'clients';
const STORAGE_KEY_LAST_SYNC = 'lastSyncClients';

export const getClients = async () => {
  try {
    // Recupera o lastSync do AsyncStorage
    const lastSync = await AsyncStorage.getItem(STORAGE_KEY_LAST_SYNC) || '2000-01-01T00:00:00.000Z';

    console.log(`📡 Fazendo requisição para API com lastSync=${lastSync}...`);

    const response = await api.get(`/clients/search/sync?lastSync=${encodeURIComponent(lastSync)}`);
    const remoteClients = response.data;

    // Recupera os clientes armazenados localmente
    const localClientsJSON = await AsyncStorage.getItem(STORAGE_KEY_CLIENTS);
    const localClients = localClientsJSON ? JSON.parse(localClientsJSON) : [];

    // Faz o merge entre os clientes locais e remotos
    const mergedClients = mergeClients(localClients, remoteClients);

    // Atualiza o AsyncStorage com clientes mesclados
    await AsyncStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(mergedClients));
    await AsyncStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());

    return mergedClients;

  } catch (error) {
    console.error("❌ Erro na requisição da API:", error.response ? error.response.data : error.message);
    throw error;
  }
};

/**
 * Mescla clientes locais com remotos, substituindo versões antigas.
 */
const mergeClients = (local, remote) => {
  const merged = [...local];
  remote.forEach(updatedClient => {
    const index = merged.findIndex(c => c.id === updatedClient.id);
    if (index > -1) merged[index] = updatedClient;
    else merged.push(updatedClient);
  });
  return merged;
};
