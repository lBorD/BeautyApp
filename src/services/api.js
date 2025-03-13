import axios from 'axios';

const api = axios.create({
  baseURL: 'https://59f0-2804-f84-4-8b44-11de-e707-3cad-1e71.ngrok-free.app',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
