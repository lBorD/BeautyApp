import api from '../../../services/api';

export const getClientProfile = async (clientId) => {
  const response = await api.get(`/clients/${clientId}/profile`);
  return response.data;
};

export const getClientHistory = async (clientId, cursor, limit = 10) => {
  const params = { limit };

  if (cursor !== null && cursor !== undefined) {
    params.cursor = cursor;
  }

  const response = await api.get(`/clients/${clientId}/appointments/history`, { params });
  return response.data;
};

export const updateClientProfile = async (clientId, payload) => {
  const response = await api.patch(`/clients/update/${clientId}`, payload);
  return response.data;
};

export const deleteClient = async (clientId) => {
  const response = await api.delete(`/clients/delete/${clientId}`);
  return response.data;
};
