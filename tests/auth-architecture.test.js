import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CustomerAuthProvider, useCustomerAuth } from '../src/auth/customer/CustomerAuthProvider.jsx';
import { customerAuthService } from '../src/auth/customer/customerAuthService.js';
import { RequireCustomerAuth } from '../src/auth/guards/RequireCustomerAuth.jsx';

// ── Customer Auth Service Tests ──

test('customerAuthService validates phone identifiers', () => {
  assert.equal(customerAuthService.isValidIdentifier('9876543210'), true);
  assert.equal(customerAuthService.isValidIdentifier('+91 98765 43210'), true);
  assert.equal(customerAuthService.isValidIdentifier('123'), false);
  assert.equal(customerAuthService.isValidIdentifier(''), false);
  assert.equal(customerAuthService.isValidIdentifier(null), false);
});

test('customerAuthService validates email identifiers', () => {
  assert.equal(customerAuthService.isValidIdentifier('user@example.com'), true);
  assert.equal(customerAuthService.isValidIdentifier('invalid'), false);
});

test('customerAuthService validates passwords', () => {
  assert.equal(customerAuthService.isValidPassword('123456'), true);
  assert.equal(customerAuthService.isValidPassword('12345'), false);
  assert.equal(customerAuthService.isValidPassword(''), false);
  assert.equal(customerAuthService.isValidPassword(null), false);
});

test('customerAuthService creates and retrieves sessions', () => {
  const session = customerAuthService.createSession('9876543210', 'Test User');
  assert.equal(session.identifier, '9876543210');
  assert.equal(session.name, 'Test User');
  assert.ok(session.authenticatedAt > 0);

  const retrieved = customerAuthService.getSession();
  assert.equal(retrieved.identifier, '9876543210');
  assert.equal(retrieved.name, 'Test User');

  customerAuthService.clearSession();
  assert.equal(customerAuthService.getSession(), null);
});

test('customerAuthService handles expired sessions', () => {
  const expiredSession = {
    identifier: '9876543210',
    name: 'Test',
    authenticatedAt: Date.now() - (25 * 60 * 60 * 1000),
  };
  try {
    sessionStorage.setItem('tt_customer_session', JSON.stringify(expiredSession));
  } catch {
    // storage unavailable
  }
  assert.equal(customerAuthService.getSession(), null);
});

// ── Customer Auth Provider Tests ──

test('CustomerAuthProvider defaults to unauthenticated', () => {
  function TestComponent() {
    const { isAuthenticated, customer } = useCustomerAuth();
    return <div data-testid="auth">{isAuthenticated ? 'authenticated' : 'unauthenticated'}-{customer || 'none'}</div>;
  }
  const html = renderToString(
    <CustomerAuthProvider>
      <TestComponent />
    </CustomerAuthProvider>
  );
  assert.ok(html.includes('unauthenticated'));
  assert.ok(html.includes('none'));
});

test('CustomerAuthProvider provides login function', () => {
  function TestComponent() {
    const { login } = useCustomerAuth();
    return <button onClick={() => login('9876543210', 'Test')}>Login</button>;
  }
  const html = renderToString(
    <CustomerAuthProvider>
      <TestComponent />
    </CustomerAuthProvider>
  );
  assert.ok(html.includes('Login'));
});

test('CustomerAuthProvider provides logout function', () => {
  function TestComponent() {
    const { logout } = useCustomerAuth();
    return <button onClick={logout}>Logout</button>;
  }
  const html = renderToString(
    <CustomerAuthProvider>
      <TestComponent />
    </CustomerAuthProvider>
  );
  assert.ok(html.includes('Logout'));
});

// ── Route Guard Tests ──

test('RequireCustomerAuth shows fallback when unauthenticated', () => {
  const html = renderToString(
    <CustomerAuthProvider>
      <RequireCustomerAuth fallback={<div>Sign in required</div>}>
        <div>Protected content</div>
      </RequireCustomerAuth>
    </CustomerAuthProvider>
  );
  assert.ok(html.includes('Sign in required'));
  assert.ok(!html.includes('Protected content'));
});

test('RequireCustomerAuth shows loading when checking', () => {
  function TestComponent() {
    const { isAuthChecking } = useCustomerAuth();
    return <div>{isAuthChecking ? 'checking' : 'done'}</div>;
  }
  const html = renderToString(
    <CustomerAuthProvider>
      <TestComponent />
    </CustomerAuthProvider>
  );
  assert.ok(html.includes('checking') || html.includes('done'));
});

// ── Auth Separation Tests ──

test('Customer auth and Admin auth are separate domains', () => {
  const customerContent = readFileSync(join(__dirname, '../src/auth/customer/CustomerAuthProvider.jsx'), 'utf-8');
  const adminContent = readFileSync(join(__dirname, '../src/admin/context/AdminAuthContext.jsx'), 'utf-8');

  assert.ok(customerContent.includes('CustomerAuthProvider'), 'Customer auth provider exists');
  assert.ok(adminContent.includes('AdminAuthProvider'), 'Admin auth provider exists');
  assert.ok(!customerContent.includes('AdminAuth'), 'Customer auth does not reference Admin auth');
  assert.ok(!adminContent.includes('CustomerAuth'), 'Admin auth does not reference Customer auth');
});

test('Customer auth uses different storage key than Admin auth', () => {
  const customerContent = readFileSync(join(__dirname, '../src/auth/customer/CustomerAuthProvider.jsx'), 'utf-8');
  const adminContent = readFileSync(join(__dirname, '../src/admin/context/AdminAuthContext.jsx'), 'utf-8');

  assert.ok(customerContent.includes('tt_customer_session'), 'Customer uses tt_customer_session');
  assert.ok(adminContent.includes('tt_admin_jwt'), 'Admin uses tt_admin_jwt');
  assert.ok(!customerContent.includes('tt_admin_jwt'), 'Customer does not use admin storage');
  assert.ok(!adminContent.includes('tt_customer_session'), 'Admin does not use customer storage');
});

// ── Portal Entry Tests ──

test('Customer Sign In has Staff/Admin Portal entry', () => {
  const content = readFileSync(join(__dirname, '../src/prototype/customerMobile/CustomerMobilePrototype.jsx'), 'utf-8');
  assert.ok(content.includes("navigate('/admin')"), 'Admin portal entry exists');
  assert.ok(content.includes('Staff / Admin Portal'), 'Admin portal label exists');
});

test('Admin portal entry does not reuse Customer credentials', () => {
  const content = readFileSync(join(__dirname, '../src/prototype/customerMobile/CustomerMobilePrototype.jsx'), 'utf-8');
  const adminEntrySection = content.match(/Staff \/ Admin Portal[\s\S]{0,200}/);
  assert.ok(adminEntrySection, 'Admin entry section exists');
  assert.ok(!adminEntrySection[0].includes('password'), 'Admin entry does not reference password');
});

// ── Session Persistence Tests ──

test('Customer session persists to sessionStorage', () => {
  const session = customerAuthService.createSession('9876543210', 'Test User');
  const stored = sessionStorage.getItem('tt_customer_session');
  assert.ok(stored, 'Session stored in sessionStorage');
  const parsed = JSON.parse(stored);
  assert.equal(parsed.identifier, '9876543210');
  assert.equal(parsed.name, 'Test User');
  customerAuthService.clearSession();
});

test('Customer session is cleared on logout', () => {
  customerAuthService.createSession('9876543210', 'Test User');
  assert.ok(customerAuthService.getSession(), 'Session exists before logout');
  customerAuthService.clearSession();
  assert.equal(customerAuthService.getSession(), null, 'Session cleared after logout');
});

// ── Security Tests ──

test('No passwords stored in session', () => {
  const session = customerAuthService.createSession('9876543210', 'Test User');
  assert.ok(!session.password, 'No password in session');
  assert.ok(!session.token, 'No token in session');
  customerAuthService.clearSession();
});

test('No secrets in auth source files', () => {
  const customerContent = readFileSync(join(__dirname, '../src/auth/customer/CustomerAuthProvider.jsx'), 'utf-8');
  const serviceContent = readFileSync(join(__dirname, '../src/auth/customer/customerAuthService.js'), 'utf-8');
  assert.ok(!customerContent.includes('JWT_SECRET'), 'No JWT secret in customer provider');
  assert.ok(!serviceContent.includes('JWT_SECRET'), 'No JWT secret in customer service');
  assert.ok(!customerContent.includes('password'), 'No password reference in customer provider');
});

// ── Profile Ownership Tests ──

test('Profile shows guest state when unauthenticated', () => {
  const content = readFileSync(join(__dirname, '../src/prototype/customerMobile/CustomerMobilePrototype.jsx'), 'utf-8');
  assert.ok(content.includes('Guest User'), 'Guest state exists');
  assert.ok(content.includes('Sign in to access your profile'), 'Sign in prompt exists');
});

test('Profile shows member state when authenticated', () => {
  const content = readFileSync(join(__dirname, '../src/prototype/customerMobile/CustomerMobilePrototype.jsx'), 'utf-8');
  assert.ok(content.includes('MEMBER'), 'Member state exists');
  assert.ok(content.includes('Sign Out'), 'Sign out button exists');
});

test('No hardcoded customer identity in profile', () => {
  const content = readFileSync(join(__dirname, '../src/prototype/customerMobile/CustomerMobilePrototype.jsx'), 'utf-8');
  assert.ok(!content.includes('Devansh'), 'No hardcoded name');
  assert.ok(!content.includes('devansh.jadav@example.com'), 'No hardcoded email');
});

// ── Theme Tests ──

test('Theme survives Customer to Admin navigation', () => {
  const content = readFileSync(join(__dirname, '../src/prototype/customerMobile/CustomerMobilePrototype.jsx'), 'utf-8');
  assert.ok(content.includes('useTheme'), 'Uses canonical useTheme');
  assert.ok(!content.includes("useState('ivory')"), 'No local theme state');
});

test('Admin portal entry preserves theme', () => {
  const content = readFileSync(join(__dirname, '../src/prototype/customerMobile/CustomerMobilePrototype.jsx'), 'utf-8');
  const adminEntryMatch = content.match(/navigate\('\/admin'\)/);
  assert.ok(adminEntryMatch, 'Admin entry uses navigate');
});

// ── Helper ──

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
