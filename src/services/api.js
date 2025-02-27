import axios from 'axios';

const api = axios.create({
  baseURL: 'https://ea18-179-109-206-16.ngrok-free.app',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
