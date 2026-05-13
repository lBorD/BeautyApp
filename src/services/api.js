import axios from 'axios';
import { getAuthToken } from './authStorage';
import { createSessionExpiredError, logout } from './sessionManager';

const api = axios.create({
  baseURL: 'https://api-h1hk.onrender.com',
  // baseURL: 'https://d8c7-160-20-204-47.ngrok-free.app',
  timeout: 40000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

let sessionRecoveryPromise = null;

const isLoginRequest = (config = {}) => {
  const url = `${config.baseURL || ''}${config.url || ''}`;
  return /\/auth\/login(?:$|[/?#])/.test(url);
};

const getErrorMessage = (data) => {
  if (!data) {
    return '';
  }

  if (typeof data === 'string') {
    return data;
  }

  const candidates = [data.message, data.error, data.detail, data.details];
  const textMessage = candidates.find((value) => typeof value === 'string');
  return textMessage || '';
};

const isTokenErrorMessage = (message) => {
  const normalizedMessage = message.toLowerCase();
  const hasTokenReference = normalizedMessage.includes('token') || normalizedMessage.includes('jwt');
  const hasAuthError = (
    normalizedMessage.includes('expir')
    || normalizedMessage.includes('invalid')
    || normalizedMessage.includes('inválid')
    || normalizedMessage.includes('unauthorized')
    || normalizedMessage.includes('não autorizado')
    || normalizedMessage.includes('not authorized')
    || normalizedMessage.includes('signature')
  );

  return hasTokenReference && hasAuthError;
};

const isUnauthorizedSessionError = (error) => {
  const status = error?.response?.status;
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const message = getErrorMessage(error.response?.data);
  return isTokenErrorMessage(message);
};

api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers.Authorization) {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error?.response) {
      return Promise.reject(error);
    }

    if (isLoginRequest(error.config) || !isUnauthorizedSessionError(error)) {
      return Promise.reject(error);
    }

    if (!sessionRecoveryPromise) {
      sessionRecoveryPromise = logout({ reason: 'expired' })
        .catch((logoutError) => {
          console.error('Erro ao limpar sessão expirada:', logoutError);
        })
        .finally(() => {
          sessionRecoveryPromise = null;
        });
    }

    await sessionRecoveryPromise;

    return Promise.reject(createSessionExpiredError(error));
  },
);

export default api;
