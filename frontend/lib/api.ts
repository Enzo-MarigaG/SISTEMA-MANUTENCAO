import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      error.message = 'Sem conexão com o servidor. Verifique se o sistema está online.';
      return Promise.reject(error);
    }
    // Não redireciona no 401 da checagem de sessão (/users/me) nem no login —
    // senão o reload da página re-dispara /users/me e cria um loop infinito.
    // Quem está logado e perde a sessão durante o uso cai aqui e vai pro login.
    const url = error.config?.url ?? '';
    const isAuthCheck = url.includes('/users/me') || url.includes('/auth/');
    if (
      error.response.status === 401 &&
      typeof window !== 'undefined' &&
      !isAuthCheck &&
      window.location.pathname !== '/login'
    ) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
