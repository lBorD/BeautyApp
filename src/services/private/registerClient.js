
import api from '../api';

const registerClient = async (clientData) => {
  try {
    const response = await api.post('/clients/register', clientData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default registerClient;
