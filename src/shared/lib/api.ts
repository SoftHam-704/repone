import axios from 'axios';

// Cria a instância do API client
export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para injetar o token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar respostas (ex: 401 para logout)
api.interceptors.response.use(
  (response) => response,
  (error: any) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sm_token');
      localStorage.removeItem('sm_auth_state');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
