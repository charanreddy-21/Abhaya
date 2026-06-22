'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import type { ReactNode } from 'react';

import { AbhayaApiError, tokenStore } from './api-client';
import { authApi } from './api';
import type { User } from './types';

// ── State ──────────────────────────────────────────────────────────────────────

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' };

type AuthAction =
  | { type: 'SET_USER'; user: User }
  | { type: 'CLEAR_USER' }
  | { type: 'LOADED_NO_USER' };

function reducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':      return { status: 'authenticated', user: action.user };
    case 'CLEAR_USER':    return { status: 'unauthenticated' };
    case 'LOADED_NO_USER': return { status: 'unauthenticated' };
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  state: AuthState;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, displayName: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: 'loading' });

  // Rehydrate from stored token on mount
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      dispatch({ type: 'LOADED_NO_USER' });
      return;
    }
    authApi.me()
      .then((user) => dispatch({ type: 'SET_USER', user }))
      .catch(() => {
        tokenStore.clear();
        dispatch({ type: 'LOADED_NO_USER' });
      });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const { user, token } = await authApi.login(email, password);
    tokenStore.set(token.access_token);
    dispatch({ type: 'SET_USER', user });
    return user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string): Promise<User> => {
      const { user, token } = await authApi.register(email, password, displayName);
      tokenStore.set(token.access_token);
      dispatch({ type: 'SET_USER', user });
      return user;
    },
    [],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    dispatch({ type: 'CLEAR_USER' });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.me();
      dispatch({ type: 'SET_USER', user });
    } catch (err) {
      if (err instanceof AbhayaApiError && err.isAuth) {
        tokenStore.clear();
        dispatch({ type: 'CLEAR_USER' });
      }
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (state.status !== 'authenticated') return;
    dispatch({ type: 'SET_USER', user: { ...state.user, ...updates } });
  }, [state]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'authenticated' ? state.user : null,
      isAuthenticated: state.status === 'authenticated',
      isLoading: state.status === 'loading',
      isAdmin: state.status === 'authenticated' && state.user.role === 'admin',
      login,
      register,
      logout,
      refreshUser,
      updateUser,
    }),
    [state, login, register, logout, refreshUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
