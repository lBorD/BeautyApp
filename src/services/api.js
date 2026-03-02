import axios from 'axios';

const api = axios.create({
  // baseURL: 'https://api-h1hk.onrender.com',
  baseURL: 'https://d8c7-160-20-204-47.ngrok-free.app',
  timeout: 40000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
