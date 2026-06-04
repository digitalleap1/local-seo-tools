import { dbConfigured, q, one } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { readJson, send, query } from '../lib/http.js';

export function computeNextRun(freq, from){
  const d = new Date(from);
  if(freq==='daily') d.setDate(d.getDate()+1);
  else if(freq==='weekly') d.setDate(d.getDate()+7);
  else if(freq==='monthly') d.setMonth(d.getMonth()+1);
  else return null;
  return d.toISOString();
}

export default async function handler(req, res){
  const auth = requireAuth(req); if(!auth) return send(res, 401, { error:'unauthorized' });
  if(!dbConfigured()) return send(res, 503, { error:'cloud not configured' });
  const owner = auth.user;
  try {
    if(req.method === 'GET'){
      const rows = await q('select * from schedules where owner=$1 order by created_at desc', [owner]);
      return send(res, 200, { schedules: rows });
    }
    if(req.method === 'POST'){
      const s = await readJson(req);
      if(!s.business_id || !s.frequency) return send(res, 400, { error:'business_id and frequency required' });
      const next = s.next_run || computeNextRun(s.frequency, Date.now());
      if(s.id){
        const row = await one(`update schedules set frequency=$2,provider=$3,grid=$4,radius=$5,unit=$6,circular=$7,scan_all=$8,enabled=$9,next_run=$10 where id=$1 and owner=$11 returning *`,
          [s.id, s.frequency, s.provider||'serper', s.grid||5, s.radius||2, s.unit||'mi', !!s.circular, s.scan_all!==false, s.enabled!==false, next, owner]);
        return send(res, 200, { schedule: row });
      }
      const row = await one(`insert into schedules(owner,business_id,frequency,provider,grid,radius,unit,circular,scan_all,enabled,next_run)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
        [owner, s.business_id, s.frequency, s.provider||'serper', s.grid||5, s.radius||2, s.unit||'mi', !!s.circular, s.scan_all!==false, s.enabled!==false, next]);
      return send(res, 201, { schedule: row });
    }
    if(req.method === 'DELETE'){
      const id = query(req).get('id'); if(!id) return send(res, 400, { error:'id required' });
      await q('delete from schedules where id=$1 and owner=$2', [id, owner]);
      return send(res, 200, { ok:true });
    }
    send(res, 405, { error:'method not allowed' });
  } catch(e){ send(res, 500, { error:String(e.message||e) }); }
}
