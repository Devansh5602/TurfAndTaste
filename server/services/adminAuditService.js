import dbAsync from '../db.js';

// This is intentionally an auth/account audit trail, not a general request
// logger. Keep the explicit allow-list small so sensitive request fields never
// become durable by accident.
const allowedMetadata = new Set(['previousRole', 'nextRole', 'sessionRevoked', 'reason']);

const safeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return null;
  const safe = Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => allowedMetadata.has(key) &&
      (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number'))
  );
  return Object.keys(safe).length ? JSON.stringify(safe) : null;
};

export async function recordAdminAudit({ actorAdminId = null, action, targetType = null, targetId = null, outcome = 'success', metadata } = {}) {
  if (!action || typeof action !== 'string') return;
  try {
    await dbAsync.run(
      'INSERT INTO admin_auth_audit (actor_admin_id, action, target_type, target_id, outcome, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
      [actorAdminId, action, targetType, targetId == null ? null : String(targetId), outcome, safeMetadata(metadata)]
    );
  } catch (error) {
    // Observability must not turn an otherwise valid management operation into
    // an outage. Operators retain server logs for investigating audit storage.
    console.error('[Admin audit] Unable to record event:', error.message);
  }
}
