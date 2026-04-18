import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'authToken';

let inMemoryToken = null;

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

export const clearAuthToken = async () => {
  inMemoryToken = null;
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
};

