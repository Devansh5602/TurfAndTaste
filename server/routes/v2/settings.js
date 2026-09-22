import express from 'express';
import dbAsync from '../../db.js';
import { authenticateAdminToken } from '../../middleware/auth.js';
import { isPlainObject, safeJsonParse, sendError, sendSuccess } from '../../utils/api.js';

const router = express.Router();
const PUBLIC_SETTING_KEYS = new Set(['public_contact']);
const MAX_VALUE_LENGTH = 8_000;

const normalizePublicSettings = (rows) => rows.reduce((settings, row) => {
  if (PUBLIC_SETTING_KEYS.has(row.key) && row.visibility === 'public') {
    settings[row.key] = safeJsonParse(row.value_json);
  }
  return settings;
}, {});

router.get('/public', async (_req, res) => {
  try {
    const rows = await dbAsync.all(
      "SELECT key, value_json, visibility FROM business_settings WHERE visibility = 'public'",
    );
    return sendSuccess(res, { settings: normalizePublicSettings(rows) });
  } catch (error) {
    console.error('[V2 Settings API Error]:', error);
    return sendError(res, 500, 'Unable to load public settings.');
  }
});

router.put('/public/:key', authenticateAdminToken, async (req, res) => {
  const { key } = req.params;
  if (!PUBLIC_SETTING_KEYS.has(key)) {
    return sendError(res, 404, 'Public setting not found.');
  }
  if (!isPlainObject(req.body?.value)) {
    return sendError(res, 400, 'Setting value must be an object.');
  }

  const serialized = JSON.stringify(req.body.value);
  if (serialized.length > MAX_VALUE_LENGTH) {
    return sendError(res, 400, 'Setting value is too large.');
  }

  try {
    await dbAsync.run(
      `INSERT INTO business_settings (key, value_json, visibility, updated_at)
       VALUES (?, ?, 'public', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET
         value_json = EXCLUDED.value_json,
         visibility = 'public',
         updated_at = CURRENT_TIMESTAMP`,
      [key, serialized],
    );
    return sendSuccess(res, { key, value: req.body.value });
  } catch (error) {
    console.error('[V2 Settings Update Error]:', error);
    return sendError(res, 500, 'Unable to save public settings.');
  }
});

export default router;
