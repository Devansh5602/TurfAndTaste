import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CustomerAuthContext = createContext(null);

const STORAGE_KEY = 'tt_customer_session';

const getStoredSession = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed || !parsed.identifier || !parsed.authenticatedAt) return null;
    const age = Date.now() - parsed.authenticatedAt;
    const maxAge = 24 * 60 * 60 * 1000;
    if (age > maxAge) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      setCustomer({ identifier: stored.identifier, name: stored.name || null });
      setIsAuthenticated(true);
    }
    setIsAuthChecking(false);
  }, []);

  const login = useCallback((identifier, name = null) => {
    const session = { identifier, name, authenticatedAt: Date.now() };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // storage unavailable
    }
    setCustomer({ identifier, name });
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
    setCustomer(null);
    setIsAuthenticated(false);
  }, []);

  const updateProfile = useCallback((updates) => {
    setCustomer((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      try {
        const stored = getStoredSession();
        if (stored) {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, ...updates }));
        }
      } catch {
        // storage unavailable
      }
      return updated;
    });
  }, []);

  return (
    <CustomerAuthContext.Provider value={{ customer, isAuthenticated, isAuthChecking, login, logout, updateProfile }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}

export default CustomerAuthProvider;
