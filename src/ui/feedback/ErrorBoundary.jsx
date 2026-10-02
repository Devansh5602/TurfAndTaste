import React, { Component } from 'react';
import { ErrorState } from './ErrorState';
import Button from '../primitives/Button';
import { Home, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (window.history && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="cm-page cm-centered cm-error-boundary" role="alert">
          <div className="cm-state-illustration" aria-hidden="true">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="cm-overline">CUSTOMER APP RECOVERY</p>
          <h1>Something went wrong</h1>
          <p>We couldn't load this screen. Your data is safe.</p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
            <Button onClick={this.handleRetry} icon={RefreshCw}>Try Again</Button>
            <Button variant="secondary" onClick={this.handleGoHome} icon={Home}>Go Home</Button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: 'var(--space-6)', textAlign: 'left', maxWidth: '400px', margin: 'var(--space-6) auto 0' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>Error Details (Development)</summary>
              <pre style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'auto', fontSize: 'var(--text-xs)' }}>
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack && '\n\n' + this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;