import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Shield, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your administrator password.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const res = await login(username.trim(), password.trim());
      if (!res.success) {
        setError(res.error || 'Invalid credentials. Please verify and try again.');
      }
    } catch (err) {
      setError(err.message || 'Authentication service unreachable.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--admin-bg, #FAF9F6)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--admin-surface, #FFFFFF)',
        border: '1px solid var(--admin-border, #EAE8E4)',
        borderRadius: 'var(--admin-radius-lg, 20px)',
        padding: '32px 24px',
        boxShadow: '0 12px 32px rgba(15, 61, 46, 0.08)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(15, 61, 46, 0.08)',
            border: '1px solid rgba(15, 61, 46, 0.18)',
            color: 'var(--admin-forest, #0F3D2E)',
            marginBottom: '12px'
          }}>
            <Shield size={28} />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--admin-text-main, #1A1C1A)' }}>
            Turf & Taste Management
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--admin-text-muted, #5A645E)' }}>
            Single Property Operations • Patan, Gujarat
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '18px',
            color: '#FCA5A5',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-main, #1A1C1A)', marginBottom: '6px', fontWeight: 600 }}>
              Management Username
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--admin-text-muted, #5A645E)' }} />
              <input
                id="admin-login-username"
                type="text"
                className="admin-input"
                style={{ paddingLeft: '38px' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-text-main, #1A1C1A)', marginBottom: '6px', fontWeight: 600 }}>
              Master Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--admin-text-muted, #5A645E)' }} />
              <input
                id="admin-login-password"
                type={showPassword ? 'text' : 'password'}
                className="admin-input"
                style={{ paddingLeft: '38px', paddingRight: '38px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '11px',
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '2px'
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            id="admin-login-submit"
            type="submit"
            className="admin-btn"
            disabled={isLoading}
            style={{ width: '100%', marginTop: '6px', height: '48px', fontSize: '0.92rem' }}
          >
            {isLoading ? 'Verifying Credentials...' : 'Sign In to Operations Portal'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.75rem', color: '#64748B' }}>
          Protected by Role-Based Access Control (RBAC) & Audit Vault.
        </div>
      </div>
    </div>
  );
}
