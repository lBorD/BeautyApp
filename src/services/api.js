import axios from 'axios';

const api = axios.create({
  // baseURL: 'https://api-h1hk.onrender.com',
  baseURL: 'https://0a8cfcd8ca85.ngrok-free.app',
  timeout: 40000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
