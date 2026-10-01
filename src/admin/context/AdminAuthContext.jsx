import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../../services/api';

const AdminAuthContext = createContext(null);

export function hasPermission(userPermissions = [], requiredPermission) {
  if (!Array.isArray(userPermissions) || !requiredPermission) return false;
  if (userPermissions.includes('*') || userPermissions.includes('super_admin')) return true;
  if (userPermissions.includes(requiredPermission)) return true;

  // Canonical alias resolution
  if (requiredPermission === 'booking.create_walkin' && userPermissions.includes('booking.walkin')) return true;
  if (requiredPermission === 'booking.walkin' && userPermissions.includes('booking.create_walkin')) return true;
  if (requiredPermission === 'dining.order.update' && userPermissions.includes('dining.order.manage')) return true;
  if (requiredPermission === 'dining.order.manage' && userPermissions.includes('dining.order.update')) return true;
  if (requiredPermission === 'booking.update' &&
      (userPermissions.includes('booking.checkin') || userPermissions.includes('booking.cancel'))) return true;

  return false;
}

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const verifyToken = async () => {
      try {
        const token = sessionStorage.getItem('tt_admin_jwt');
        if (!token) {
          if (!cancelled) {
            setIsAuthenticated(false);
            setAdmin(null);
            setIsAuthChecking(false);
          }
          return;
        }

        const res = await api.verifyAdminToken();
        if (!cancelled) {
          if (res?.success && res?.admin) {
            setAdmin(res.admin);
            setIsAuthenticated(true);
          } else {
            sessionStorage.removeItem('tt_admin_jwt');
            setAdmin(null);
            setIsAuthenticated(false);
          }
        }
      } catch {
        if (!cancelled) {
          setAdmin(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setIsAuthChecking(false);
      }
    };

    verifyToken();
    return () => { cancelled = true; };
  }, []);

  const login = async (username, password) => {
    const res = await api.adminLogin(username, password);
    if (res?.success && res?.token) {
      sessionStorage.setItem('tt_admin_jwt', res.token);
      setAdmin(res.user);
      setIsAuthenticated(true);
      return { success: true, user: res.user };
    }
    return { success: false, error: res?.error || 'Invalid credentials' };
  };

  const logout = () => {
    sessionStorage.removeItem('tt_admin_jwt');
    setAdmin(null);
    setIsAuthenticated(false);
  };

  const can = (permissionKey) => {
    if (!admin) return false;
    if (admin.role === 'super_admin') return true;
    return hasPermission(admin.permissions || [], permissionKey);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isAuthenticated, isAuthChecking, login, logout, can }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
