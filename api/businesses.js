import { dbConfigured, q, one } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { readJson, send, query } from '../lib/http.js';

const COLS = ['name','gbp_url','place_id','primary_cat','website','phone','address','city','state','country','postal_code','latitude','longitude','status'];

export default async function handler(req, res){
  const auth = requireAuth(req); if(!auth) return send(res, 401, { error:'unauthorized' });
  if(!dbConfigured()) return send(res, 503, { error:'cloud not configured' });
  const owner = auth.user;
  try {
    if(req.method === 'GET'){
      const rows = await q('select * from businesses where owner=$1 order by created_at desc', [owner]);
      return send(res, 200, { businesses: rows });
    }
    if(req.method === 'POST'){
      const b = await readJson(req);
      if(!b || !b.name) return send(res, 400, { error:'name is required' });
      const vals = COLS.map(c => c==='status' ? (b.status||'active') : (b[c] ?? null));
      if(b.id){
        const set = COLS.map((c,i)=>`${c}=$${i+2}`).join(',');
        const row = await one(`update businesses set ${set}, updated_at=now() where id=$1 and owner=$${COLS.length+2} returning *`, [b.id, ...vals, owner]);
        if(!row) return send(res, 404, { error:'not found' });
        return send(res, 200, { business: row });
      }
      const ph = COLS.map((_,i)=>`$${i+2}`).join(',');
      const row = await one(`insert into businesses(owner,${COLS.join(',')}) values($1,${ph}) returning *`, [owner, ...vals]);
      return send(res, 201, { business: row });
    }
    if(req.method === 'DELETE'){
      const id = query(req).get('id'); if(!id) return send(res, 400, { error:'id required' });
      await q('delete from businesses where id=$1 and owner=$2', [id, owner]);
      return send(res, 200, { ok:true });
    }
    send(res, 405, { error:'method not allowed' });
  } catch(e){ send(res, 500, { error:String(e.message||e) }); }
}
