import axios from 'axios';

const api = axios.create({
  baseURL: 'https://7d82-2804-f84-4-de14-2dc3-2f96-d2c8-c5ac.ngrok-free.app',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
