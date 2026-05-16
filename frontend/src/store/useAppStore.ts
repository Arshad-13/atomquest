import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  userRole: 'employee' | 'manager' | 'admin' | null;
  setUserRole: (role: 'employee' | 'manager' | 'admin' | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initialize theme based on user's system preference or default to light
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    // Apply the dark class to the HTML document body
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: newTheme };
  }),
  
  userRole: null,
  setUserRole: (role) => set({ userRole: role }),
}));