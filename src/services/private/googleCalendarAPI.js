import api from '../api';

export const getGoogleCalendarStatus = async () => {
  const response = await api.get('/integrations/google-calendar/status');
  return response.data;
};

export const connectGoogleCalendar = async (payload) => {
  const response = await api.post('/integrations/google-calendar/connect', payload);
  return response.data;
};

export const disconnectGoogleCalendar = async () => {
  const response = await api.delete('/integrations/google-calendar/disconnect');
  return response.data;
};
