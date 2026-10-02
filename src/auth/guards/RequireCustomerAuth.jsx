import React from 'react';
import { useCustomerAuth } from '../customer/CustomerAuthProvider';

export default function RequireCustomerAuth({ children, fallback = null }) {
  const { isAuthenticated, isAuthChecking } = useCustomerAuth();

  if (isAuthChecking) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return fallback;
  }

  return children;
}
