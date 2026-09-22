import express from 'express';
import dbAsync from '../../db.js';
import { authenticateAdminToken } from '../../middleware/auth.js';
import { isPlainObject, safeJsonParse, sendError, sendSuccess } from '../../utils/api.js';

const router = express.Router();
const validId = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''));
const publicStall = (row) => ({ id: row.id, slug: row.slug, name: row.name, stallType: row.stall_type,
  shortDescription: row.short_description, description: row.description, logoImageUrl: row.logo_image_url,
  coverImageUrl: row.cover_image_url, operatingHours: safeJsonParse(row.operating_hours_json, []),
  displayOrder: row.display_order, metadata: safeJsonParse(row.metadata_json) });
const adminStall = (row) => ({ ...publicStall(row), status: row.status, contact: safeJsonParse(row.contact_json) });
const publicItem = (row) => ({ id: row.id, categoryId: row.category_id, name: row.name, description: row.description,
  pricePaise: row.price_paise, imageUrl: row.image_url, dietaryType: row.dietary_type,
  featured: Boolean(row.is_featured), displayOrder: row.display_order, metadata: safeJsonParse(row.metadata_json) });
const adminItem = (row) => ({ ...publicItem(row), available: Boolean(row.is_available), active: Boolean(row.is_active) });
const boundedText = (value, max = 4000) => value == null || (typeof value === 'string' && value.trim().length <= max);
const jsonObject = (value) => value == null || isPlainObject(value);
const jsonArray = (value) => value == null || Array.isArray(value);

async function findStall(identifier, includeHidden = false) {
  return dbAsync.get(`SELECT * FROM food_stalls WHERE (id = ? OR slug = ?) ${includeHidden ? '' : "AND status = 'active'"} LIMIT 1`, [identifier, identifier]);
}
async function readPublicDetail(stall) {
  const categories = await dbAsync.all('SELECT id, slug, name, description, display_order FROM food_menu_categories WHERE stall_id = ? AND is_active = 1 ORDER BY display_order, name', [stall.id]);
  const items = await dbAsync.all('SELECT * FROM food_menu_items WHERE stall_id = ? AND is_active = 1 AND is_available = 1 ORDER BY is_featured DESC, display_order, name', [stall.id]);
  return { ...publicStall(stall), categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, displayOrder: c.display_order })), menuItems: items.map(publicItem) };
}

router.get('/', async (_req, res) => {
  try { const rows = await dbAsync.all("SELECT * FROM food_stalls WHERE status = 'active' ORDER BY display_order, name"); return sendSuccess(res, { stalls: rows.map(publicStall) }); }
  catch (error) { console.error('[Food public list]', error); return sendError(res, 500, 'Unable to load food stalls.'); }
});
router.get('/admin/all', authenticateAdminToken, async (_req, res) => {
  try { const stalls = await dbAsync.all('SELECT * FROM food_stalls ORDER BY display_order, name'); return sendSuccess(res, { stalls: await Promise.all(stalls.map(async (s) => ({ ...adminStall(s), categories: await dbAsync.all('SELECT * FROM food_menu_categories WHERE stall_id = ? ORDER BY display_order, name', [s.id]), menuItems: (await dbAsync.all('SELECT * FROM food_menu_items WHERE stall_id = ? ORDER BY display_order, name', [s.id])).map(adminItem) }))) }); }
  catch (error) { console.error('[Food admin list]', error); return sendError(res, 500, 'Unable to load food management data.'); }
});

const saveStall = async (req, res, create) => {
  if (!isPlainObject(req.body)) return sendError(res, 400, 'Stall payload must be an object.');
  const old = create ? null : await findStall(req.params.identifier, true); if (!create && !old) return sendError(res, 404, 'Food stall not found.');
  const id = create ? String(req.body.id || '') : old.id, slug = String(req.body.slug ?? old?.slug ?? '').trim().toLowerCase(), name = String(req.body.name ?? old?.name ?? '').trim();
  const type = String(req.body.stallType ?? old?.stall_type ?? 'food'), status = String(req.body.status ?? old?.status ?? 'draft');
  if (!validId(id)) return sendError(res, 400, 'Stall validation failed.', { field: 'id', reason: 'Use lowercase kebab-case.' });
  if (!validId(slug)) return sendError(res, 400, 'Stall validation failed.', { field: 'slug', reason: 'Use lowercase kebab-case.' });
  if (name.length < 2 || name.length > 255) return sendError(res, 400, 'Stall validation failed.', { field: 'name', reason: 'Use 2–255 characters.' });
  if (!['food', 'parlour'].includes(type)) return sendError(res, 400, 'Stall validation failed.', { field: 'stallType', reason: 'Choose food or parlour.' });
  if (!['draft', 'active', 'inactive'].includes(status)) return sendError(res, 400, 'Stall validation failed.', { field: 'status', reason: 'Choose draft, active, or inactive.' });
  const textField = ['shortDescription', 'description', 'logoImageUrl', 'coverImageUrl'].find((field) => !boundedText(req.body[field]));
  if (textField) return sendError(res, 400, 'Stall validation failed.', { field: textField, reason: 'Use text no longer than 4,000 characters.' });
  if (!jsonArray(req.body.operatingHours)) return sendError(res, 400, 'Stall validation failed.', { field: 'operatingHours', reason: 'Use an array.' });
  if (!jsonObject(req.body.contact)) return sendError(res, 400, 'Stall validation failed.', { field: 'contact', reason: 'Use an object.' });
  if (!jsonObject(req.body.metadata)) return sendError(res, 400, 'Stall validation failed.', { field: 'metadata', reason: 'Use an object.' });
  const order = Number(req.body.displayOrder ?? old?.display_order ?? 0); if (!Number.isInteger(order) || order < 0 || order > 100000) return sendError(res, 400, 'displayOrder must be a non-negative whole number.');
  try { await dbAsync.run(`INSERT INTO food_stalls (id, slug, name, stall_type, status, short_description, description, logo_image_url, cover_image_url, operating_hours_json, contact_json, metadata_json, display_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug,name=EXCLUDED.name,stall_type=EXCLUDED.stall_type,status=EXCLUDED.status,short_description=EXCLUDED.short_description,description=EXCLUDED.description,logo_image_url=EXCLUDED.logo_image_url,cover_image_url=EXCLUDED.cover_image_url,operating_hours_json=EXCLUDED.operating_hours_json,contact_json=EXCLUDED.contact_json,metadata_json=EXCLUDED.metadata_json,display_order=EXCLUDED.display_order,updated_at=CURRENT_TIMESTAMP`, [id,slug,name,type,status,req.body.shortDescription ?? old?.short_description ?? null,req.body.description ?? old?.description ?? null,req.body.logoImageUrl ?? old?.logo_image_url ?? null,req.body.coverImageUrl ?? old?.cover_image_url ?? null,JSON.stringify(req.body.operatingHours ?? safeJsonParse(old?.operating_hours_json, [])),JSON.stringify(req.body.contact ?? safeJsonParse(old?.contact_json)),JSON.stringify(req.body.metadata ?? safeJsonParse(old?.metadata_json)),order]); const saved = await findStall(id,true); return sendSuccess(res,{ stall: adminStall(saved)},create?201:200); }
  catch (error) { return sendError(res, /UNIQUE/.test(error.message) || error.code === '23505' ? 409 : 500, 'Unable to save food stall.'); }
};
router.post('/admin/stalls', authenticateAdminToken, (req,res) => saveStall(req,res,true));
router.put('/admin/stalls/:identifier', authenticateAdminToken, (req,res) => saveStall(req,res,false));

const saveCategory = async (req,res,create) => { const old = create ? null : await dbAsync.get('SELECT * FROM food_menu_categories WHERE id = ?', [req.params.id]); const b=req.body||{}; const id=create?String(b.id||''):old?.id, stallId=String(b.stallId??old?.stall_id??''),slug=String(b.slug??old?.slug??'').toLowerCase(),name=String(b.name??old?.name??'').trim(),order=Number(b.displayOrder??old?.display_order??0); if(!isPlainObject(b)||!validId(id)||!validId(stallId)||!validId(slug)||name.length<2||!Number.isInteger(order)||!(await findStall(stallId,true))) return sendError(res,400,'Category data is invalid.'); try { await dbAsync.run(`INSERT INTO food_menu_categories (id,stall_id,slug,name,description,is_active,display_order) VALUES (?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET stall_id=EXCLUDED.stall_id,slug=EXCLUDED.slug,name=EXCLUDED.name,description=EXCLUDED.description,is_active=EXCLUDED.is_active,display_order=EXCLUDED.display_order`,[id,stallId,slug,name,b.description??old?.description??null,b.active===false?0:1,order]); return sendSuccess(res,{id},create?201:200);} catch(e){return sendError(res,/UNIQUE/.test(e.message)||e.code==='23505'?409:500,'Unable to save menu category.');} };
router.post('/admin/categories',authenticateAdminToken,(q,s)=>saveCategory(q,s,true)); router.put('/admin/categories/:id',authenticateAdminToken,(q,s)=>saveCategory(q,s,false));

const saveItem=async(req,res,create)=>{const old=create?null:await dbAsync.get('SELECT * FROM food_menu_items WHERE id=?',[req.params.id]);const b=req.body||{},id=create?String(b.id||''):old?.id,stallId=String(b.stallId??old?.stall_id??''),categoryId=b.categoryId??old?.category_id??null,name=String(b.name??old?.name??'').trim(),price=Number(b.pricePaise??old?.price_paise),order=Number(b.displayOrder??old?.display_order??0),diet=String(b.dietaryType??old?.dietary_type??'unspecified');if(!isPlainObject(b)||!validId(id)||!validId(stallId)||name.length<2||!Number.isInteger(price)||price<0||price>100000000||!Number.isInteger(order)||!['veg','non_veg','vegan','egg','unspecified'].includes(diet)||!(await findStall(stallId,true)))return sendError(res,400,'Menu item data is invalid.');if(categoryId){const c=await dbAsync.get('SELECT id FROM food_menu_categories WHERE id=? AND stall_id=?',[categoryId,stallId]);if(!c)return sendError(res,400,'Category must belong to this stall.');}try{await dbAsync.run(`INSERT INTO food_menu_items (id,stall_id,category_id,name,description,price_paise,image_url,dietary_type,is_available,is_featured,is_active,display_order,metadata_json,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET stall_id=EXCLUDED.stall_id,category_id=EXCLUDED.category_id,name=EXCLUDED.name,description=EXCLUDED.description,price_paise=EXCLUDED.price_paise,image_url=EXCLUDED.image_url,dietary_type=EXCLUDED.dietary_type,is_available=EXCLUDED.is_available,is_featured=EXCLUDED.is_featured,is_active=EXCLUDED.is_active,display_order=EXCLUDED.display_order,metadata_json=EXCLUDED.metadata_json,updated_at=CURRENT_TIMESTAMP`,[id,stallId,categoryId,name,b.description??old?.description??null,price,b.imageUrl??old?.image_url??null,diet,b.available===false?0:1,b.featured===true?1:0,b.active===false?0:1,order,JSON.stringify(b.metadata??safeJsonParse(old?.metadata_json))]);return sendSuccess(res,{id},create?201:200)}catch(e){return sendError(res,500,'Unable to save menu item.')}};
router.post('/admin/items',authenticateAdminToken,(q,s)=>saveItem(q,s,true));router.put('/admin/items/:id',authenticateAdminToken,(q,s)=>saveItem(q,s,false));
router.get('/:identifier', async (req, res) => {
  try { const stall = await findStall(req.params.identifier); if (!stall) return sendError(res, 404, 'Food stall not found.'); return sendSuccess(res, { stall: await readPublicDetail(stall) }); }
  catch (error) { console.error('[Food public detail]', error); return sendError(res, 500, 'Unable to load this food stall.'); }
});
export default router;
