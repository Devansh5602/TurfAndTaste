/** Shared response and input helpers for additive v2 endpoints. */
export const sendSuccess = (res, data, status = 200) => res.status(status).json({
  success: true,
  data,
});

export const sendError = (res, status, error, details) => res.status(status).json({
  success: false,
  error,
  ...(details ? { details } : {}),
});

export const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const safeJsonParse = (value, fallback = {}) => {
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};
