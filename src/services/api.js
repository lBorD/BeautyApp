import axios from 'axios';

const api = axios.create({
  baseURL: 'https://de1a-179-109-206-245.ngrok-free.app',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
