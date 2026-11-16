import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'authToken';
const AUTH_USER_KEY = 'authUser';

export const ROLE_OWNER = 'owner';
export const ROLE_STAFF = 'staff';

let inMemoryToken = null;
let inMemoryUser = null;

export const getAuthToken = async () => {
  if (inMemoryToken) {
    return inMemoryToken;
  }

  const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  inMemoryToken = storedToken;
  return storedToken;
};

export const setAuthToken = async (token) => {
  inMemoryToken = token || null;

  if (token) {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }

  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
};

// Sessao aberta antes da equipe existir nao tem usuario salvo: e da dona,
// como o token antigo, so com `{ id }`, tambem e tratado na API.
const normalizeAuthUser = (user) => ({
  id: user?.id ?? null,
  name: user?.name || '',
  email: user?.email || '',
  role: user?.role === ROLE_STAFF ? ROLE_STAFF : ROLE_OWNER,
});

export const getCachedAuthUser = () => (inMemoryUser ? normalizeAuthUser(inMemoryUser) : null);

export const getAuthUser = async () => {
  if (inMemoryUser) {
    return normalizeAuthUser(inMemoryUser);
  }

  try {
    const storedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
    inMemoryUser = storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    inMemoryUser = null;
  }

  return normalizeAuthUser(inMemoryUser);
};

export const setAuthUser = async (user) => {
  inMemoryUser = user || null;

  if (user) {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return;
  }

  await AsyncStorage.removeItem(AUTH_USER_KEY);
};

export const isStaffUser = (user) => user?.role === ROLE_STAFF;

export const clearAuthToken = async () => {
  inMemoryToken = null;
  inMemoryUser = null;
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
};

