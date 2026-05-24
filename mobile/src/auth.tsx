import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  login as apiLogin,
  loginWithGoogle as apiLoginWithGoogle,
  completeSignup as apiCompleteSignup,
  completePasswordReset as apiCompletePasswordReset,
  getCurrentUser,
  type CompleteSignupProfile,
  type Token,
} from './api';

class MobileLoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MobileLoginError';
  }
}

function assertCustomerToken(t: Token): void {
  if (t.user.role !== 'customer') {
    throw new MobileLoginError(
      'Bu hesap mobil uygulama için kullanılamaz. Yönetici/operatör hesabıyla admin paneline giriş yapın.',
    );
  }
}

const TOKEN_KEY = 'carparking_token';
const LAST_ACTIVE_KEY = 'carparking_last_active';
const INACTIVITY_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;

type AuthContextType = {
  token: string | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  completeSignup: (
    signupToken: string,
    password: string,
    profile: CompleteSignupProfile,
  ) => Promise<void>;
  completePasswordReset: (resetToken: string, password: string) => Promise<void>;
  logout: () => void;
  touchActivity: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function persistActivity() {
  await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedToken, lastActiveRaw] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(LAST_ACTIVE_KEY),
      ]);
      if (storedToken) {
        const lastActive = lastActiveRaw ? Number(lastActiveRaw) : NaN;
        const expired =
          !Number.isFinite(lastActive) || Date.now() - lastActive > INACTIVITY_LIMIT_MS;
        if (expired) {
          await Promise.all([
            AsyncStorage.removeItem(TOKEN_KEY),
            AsyncStorage.removeItem(LAST_ACTIVE_KEY),
          ]);
          setToken(null);
        } else {
          // Token sahibinin rolü 'customer' değilse (örn. admin/operator),
          // bu cihazda oturumu reddet ve token'ı temizle.
          try {
            const me = await getCurrentUser(storedToken);
            if (me.role !== 'customer') {
              await Promise.all([
                AsyncStorage.removeItem(TOKEN_KEY),
                AsyncStorage.removeItem(LAST_ACTIVE_KEY),
              ]);
              setToken(null);
            } else {
              setToken(storedToken);
              void persistActivity();
            }
          } catch {
            // Token geçersiz/eski → temizle
            await Promise.all([
              AsyncStorage.removeItem(TOKEN_KEY),
              AsyncStorage.removeItem(LAST_ACTIVE_KEY),
            ]);
            setToken(null);
          }
        }
      }
      setInitialized(true);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const t = await apiLogin(email, password);
    assertCustomerToken(t);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, t.access_token),
      AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())),
    ]);
    setToken(t.access_token);
  };

  const loginWithGoogle = async (accessToken: string) => {
    const t = await apiLoginWithGoogle(accessToken);
    assertCustomerToken(t);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, t.access_token),
      AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())),
    ]);
    setToken(t.access_token);
  };

  const completeSignup = async (
    signupToken: string,
    password: string,
    profile: CompleteSignupProfile,
  ) => {
    const t = await apiCompleteSignup(signupToken, password, profile);
    // Yeni kayıt zaten customer rolünde döner; yine de defansif kontrol.
    assertCustomerToken(t);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, t.access_token),
      AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())),
    ]);
    setToken(t.access_token);
  };

  const completePasswordReset = async (resetToken: string, password: string) => {
    await apiCompletePasswordReset(resetToken, password);
  };

  const logout = useCallback(() => {
    void Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(LAST_ACTIVE_KEY),
    ]);
    setToken(null);
  }, []);

  const touchActivity = useCallback(() => {
    void persistActivity();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        initialized,
        login,
        loginWithGoogle,
        completeSignup,
        completePasswordReset,
        logout,
        touchActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
