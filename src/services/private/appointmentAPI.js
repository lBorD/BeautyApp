import api from '../api';

export const listAppointments = async ({ from, to }) => {
  const response = await api.get('/appointments', {
    params: { from, to },
  });

  return response.data;
};

export const createAppointment = async (payload) => {
  const response = await api.post('/appointments', payload);
  return response.data;
};

export const updateAppointment = async (id, payload) => {
  const response = await api.patch(`/appointments/${id}`, payload);
  return response.data;
};

export const updateAppointmentStatus = async (id, status) => {
  const response = await api.patch(`/appointments/${id}/status`, { status });
  return response.data;
};

// Marca `archivedAt` no atendimento. A API so aceita registros ja cancelados e
// passa a excluir arquivados das listagens, entao ele nao volta a aparecer.
export const archiveAppointment = async (id) => {
  const response = await api.patch(`/appointments/${id}/archive`);
  return response.data;
};
