import { create } from 'zustand';
import { apiClient } from '../api/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'admin';
}

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  
  // Real Auth State (Cookie-driven, token is in-memory only)
  user: null, 
  token: localStorage.getItem('zenithokr_token'), 
  
  setAuth: (user, token) => {
    localStorage.setItem('zenithokr_token', token);
    set({ user, token });
  },
  
  logout: () => {
    localStorage.removeItem('zenithokr_token');
    apiClient.post('/auth/logout').catch(() => {});
    set({ user: null, token: null });
  },
}));