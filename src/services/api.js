import axios from 'axios';
import { getAuthToken } from './authStorage';

const api = axios.create({
  baseURL: 'https://api-h1hk.onrender.com',
  // baseURL: 'https://d8c7-160-20-204-47.ngrok-free.app',
  timeout: 40000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

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

export default api;

