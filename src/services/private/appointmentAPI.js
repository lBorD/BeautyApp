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

export const getAppointmentSuggestions = async ({ from, to, serviceId, serviceIds, excludeAppointmentId }) => {
  const params = {
    from,
    to,
  };

  if (serviceIds?.length) {
    params.serviceIds = serviceIds.join(',');
  } else if (serviceId) {
    params.serviceId = serviceId;
  }

  if (excludeAppointmentId) {
    params.excludeAppointmentId = excludeAppointmentId;
  }

  const response = await api.get('/appointments/suggestions', { params });
  return response.data;
};
