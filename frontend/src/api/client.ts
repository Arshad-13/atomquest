import axios from 'axios';
import { useAppStore } from '../store/useAppStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor: Global error handling per Phase 9.1
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const dataDetail = error.response?.data?.detail;

    if (status === 401) {
      // Token expired or invalid — force logout and redirect via useAppStore
      useAppStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (status === 403) {
      // Insufficient role
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: { type: 'error', message: dataDetail || "Access denied: you don't have permission to do that." }
      }));
      return Promise.reject(error);
    }

    if (status === 422) {
      // FastAPI validation error
      const message = Array.isArray(dataDetail)
        ? dataDetail.map((e: any) => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join(' | ')
        : (dataDetail ?? 'Validation error. Please check your inputs.');
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: { type: 'error', message }
      }));
      return Promise.reject(error);
    }

    if (status >= 400 && status < 500) {
      // General client errors (400, 404, 409, etc)
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: { type: 'error', message: typeof dataDetail === 'string' ? dataDetail : "Request failed." }
      }));
      return Promise.reject(error);
    }

    if (status >= 500 || !status) {
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: { type: 'error', message: 'Server error. Please try again in a moment.' }
      }));
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);