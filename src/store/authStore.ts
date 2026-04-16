import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  partnerName: string;
  login: (passcode: string) => Promise<boolean>;
  logout: () => void;
  setPartnerName: (name: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      partnerName: 'Partner',

      login: async (passcode: string) => {
        try {
          const response = await fetch('/api/auth-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode }),
          });
          const data = await response.json();
          if (data.success) {
            set({ isAuthenticated: true });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      logout: () => set({ isAuthenticated: false }),

      setPartnerName: (name: string) => set({ partnerName: name }),
    }),
    {
      name: 'aql-auth',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, partnerName: state.partnerName }),
    }
  )
);
