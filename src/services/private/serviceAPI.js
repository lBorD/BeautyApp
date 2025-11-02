import api from '../api';

export const registerService = async (serviceData) => {
  try {
    const response = await api.post('/services/register', serviceData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const listServices = async (params = {}) => {
  try {
    const { page = 1, limit = 10, active = true, search = '' } = params;
    const response = await api.get('/services/search', {
      params: { page, limit, active, search }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getServiceById = async (id) => {
  try {
    const response = await api.get(`/services/search/by-id/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateService = async (id, serviceData) => {
  try {
    const response = await api.patch(`/services/update/${id}`, serviceData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteService = async (id) => {
  try {
    const response = await api.delete(`/services/delete/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const listActiveServices = async () => {
  try {
    const response = await api.get('/services/search/active');
    return response.data;
  } catch (error) {
    throw error;
  }
};
