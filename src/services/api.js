import axios from 'axios';

const api = axios.create({
  // baseURL: 'https://api-h1hk.onrender.com',
  baseURL: 'https://e603-179-109-206-86.ngrok-free.app/',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
