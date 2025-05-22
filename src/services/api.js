import axios from 'axios';

const api = axios.create({
  // baseURL: 'https://api-h1hk.onrender.com',
  baseURL: 'https://4fd9-2804-f84-5-1156-992f-1b50-4bca-f928.ngrok-free.app',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
