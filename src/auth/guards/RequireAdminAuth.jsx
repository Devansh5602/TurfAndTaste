import React from 'react';
import { useAdminAuth } from '../../admin/context/AdminAuthContext';

export default function RequireAdminAuth({ children, fallback = null }) {
  const { isAuthenticated, isAuthChecking } = useAdminAuth();

  if (isAuthChecking) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return fallback;
  }

  return children;
}
