import axios from 'axios';

const api = axios.create({
  baseURL: 'https://9319-170-238-149-213.ngrok-free.app',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
