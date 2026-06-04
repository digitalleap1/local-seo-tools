// Manual "Run now" — runs one schedule's scan immediately (ignores next_run),
// stores results, updates last_run (does NOT advance next_run). Uses env keys.
import { dbConfigured, one } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { readJson, send } from '../lib/http.js';
import { runScheduleScan } from '../lib/runner.js';

export default async function handler(req, res){
  if(req.method !== 'POST') return send(res, 405, { error:'POST only' });
  const auth = requireAuth(req); if(!auth) return send(res, 401, { error:'unauthorized' });
  if(!dbConfigured()) return send(res, 503, { error:'cloud not configured' });
  try {
    const b = await readJson(req);
    if(!b.schedule_id) return send(res, 400, { error:'schedule_id required' });
    const s = await one('select * from schedules where id=$1 and owner=$2', [b.schedule_id, auth.user]);
    if(!s) return send(res, 404, { error:'schedule not found' });
    const result = await runScheduleScan(s, { reschedule:false });
    send(res, 200, { ok:true, result });
  } catch(e){ send(res, 500, { error:String(e.message||e) }); }
}
