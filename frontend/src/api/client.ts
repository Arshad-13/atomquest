import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('atomquest_token');
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

    if (status === 401) {
      // Token expired or invalid — force logout and redirect
      localStorage.removeItem('atomquest_token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (status === 403) {
      // Insufficient role — show a toast via a custom event the ToastContainer listens to
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: { type: 'error', message: "Access denied: you don't have permission to do that." }
      }));
      return Promise.reject(error);
    }

    if (status === 422) {
      // FastAPI validation error — surface the detail array as a readable message
      const detail = error.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join(' | ')
        : (detail ?? 'Validation error. Please check your inputs.');
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: { type: 'error', message }
      }));
      return Promise.reject(error);
    }

    if (status === 500 || !status) {
      window.dispatchEvent(new CustomEvent('api-error', {
        detail: { type: 'error', message: 'Server error. Please try again in a moment.' }
      }));
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);