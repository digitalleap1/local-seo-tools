import { dbConfigured, pool } from '../lib/db.js';
import { SCHEMA_SQL } from '../lib/schema.js';
import { requireAuth } from '../lib/auth.js';
import { send } from '../lib/http.js';
export default async function handler(req, res){
  if(req.method !== 'POST') return send(res, 405, { error:'POST only' });
  if(!requireAuth(req)) return send(res, 401, { error:'unauthorized' });
  if(!dbConfigured()) return send(res, 503, { error:'DATABASE_URL not set' });
  try { await pool().query(SCHEMA_SQL); send(res, 200, { ok:true, message:'Schema applied' }); }
  catch(e){ send(res, 500, { error:String(e.message||e) }); }
}
