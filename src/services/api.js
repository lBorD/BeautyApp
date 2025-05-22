import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api-h1hk.onrender.com',
  //baseURL: 'https://c77d-2804-f84-5-1156-6c13-c40f-9581-bf79.ngrok-free.app',
  timeout: 40000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

export default api;
