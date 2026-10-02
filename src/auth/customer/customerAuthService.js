const STORAGE_KEY = 'tt_customer_session';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

export const customerAuthService = {
  getSession() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (!parsed || !parsed.identifier || !parsed.authenticatedAt) return null;
      const age = Date.now() - parsed.authenticatedAt;
      if (age > SESSION_MAX_AGE) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  createSession(identifier, name = null) {
    const session = { identifier, name, authenticatedAt: Date.now() };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // storage unavailable
    }
    return session;
  },

  clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
  },

  isValidIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') return false;
    const cleaned = identifier.trim();
    if (cleaned.length < 2) return false;
    const phoneDigits = cleaned.replace(/\D/g, '');
    if (phoneDigits.length >= 10) return true;
    if (cleaned.includes('@')) return true;
    return false;
  },

  isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6;
  },
};
