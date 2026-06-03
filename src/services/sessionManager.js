import { clearAuthToken } from './authStorage';

export const SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';

let sessionExpiredHandler = null;

export const setSessionExpiredHandler = (handler) => {
  sessionExpiredHandler = typeof handler === 'function' ? handler : null;
};

export const logout = async ({ reason = 'manual' } = {}) => {
  await clearAuthToken();

  if (sessionExpiredHandler) {
    await sessionExpiredHandler({ reason });
  }
};

export const createSessionExpiredError = (originalError) => {
  const error = new Error('Sessão expirada. Faça login novamente.');
  error.code = SESSION_EXPIRED_CODE;
  error.isSessionExpired = true;
  error.originalError = originalError;

  return error;
};

export const isSessionExpiredError = (error) => (
  error?.code === SESSION_EXPIRED_CODE || error?.isSessionExpired === true
);
