import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api-h1hk.onrender.com',
  timeout: 50000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
