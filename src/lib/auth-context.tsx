import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export type UserRole = 'admin' | 'bursar' | 'viewer';

export interface User {
  id: number;
  full_name: string;
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAdmin: boolean;
  isBursar: boolean;
  isViewer: boolean;
  canManageUsers: boolean;
  canManageFees: boolean;
  canRecordPayments: boolean;
  canManageStudents: boolean;
  canVoidPayments: boolean;
  canViewReports: boolean;
  canViewLogs: boolean;
  canBackup: boolean;
  timeUntilLock: number | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTO_LOCK_MINUTES = 15;
const AUTO_LOCK_MS = AUTO_LOCK_MINUTES * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [timeUntilLock, setTimeUntilLock] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const login = useCallback((u: User) => {
    setUser(u);
    lastActivityRef.current = Date.now();
    setTimeUntilLock(AUTO_LOCK_MS);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setTimeUntilLock(null);
  }, []);

  // Track user activity
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      setTimeUntilLock(AUTO_LOCK_MS);
    };

    events.forEach(e => window.addEventListener(e, updateActivity));
    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
    };
  }, [user]);

  // Auto-lock timer
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, AUTO_LOCK_MS - idle);
      setTimeUntilLock(remaining);

      if (remaining <= 0) {
        console.log('[Auth] Auto-locked due to inactivity');
        logout();
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, logout]);

  const isAdmin = user?.role === 'admin';
  const isBursar = user?.role === 'bursar';
  const isViewer = user?.role === 'viewer';

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAdmin,
    isBursar,
    isViewer,
    canManageUsers: isAdmin,
    canManageFees: isAdmin,
    canRecordPayments: isAdmin || isBursar,
    canManageStudents: isAdmin || isBursar,
    canVoidPayments: isAdmin,
    canViewReports: true,
    canViewLogs: isAdmin,
    canBackup: isAdmin,
    timeUntilLock,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
