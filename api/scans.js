import { dbConfigured, q, one } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { readJson, send, query } from '../lib/http.js';

export default async function handler(req, res){
  const auth = requireAuth(req); if(!auth) return send(res, 401, { error:'unauthorized' });
  if(!dbConfigured()) return send(res, 503, { error:'cloud not configured' });
  const owner = auth.user;
  try {
    if(req.method === 'GET'){
      const bid = query(req).get('business_id');
      const kw = query(req).get('keyword');
      const lim = Math.min(200, parseInt(query(req).get('limit')||'60',10) || 60);
      let rows;
      if(bid && kw) rows = await q('select * from scans where owner=$1 and business_id=$2 and keyword=$3 order by created_at desc limit $4', [owner,bid,kw,lim]);
      else if(bid) rows = await q('select * from scans where owner=$1 and business_id=$2 order by created_at desc limit $3', [owner,bid,lim]);
      else rows = await q('select * from scans where owner=$1 order by created_at desc limit $2', [owner,lim]);
      return send(res, 200, { scans: rows });
    }
    if(req.method === 'POST'){
      const s = await readJson(req);
      if(!s || !s.keyword || !s.results) return send(res, 400, { error:'keyword and results required' });
      const row = await one(`insert into scans(owner,business_id,keyword,center_lat,center_lng,grid,radius,unit,circular,source,metrics,results,comps)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id, created_at`,
        [owner, s.business_id||null, s.keyword, s.center_lat??null, s.center_lng??null, s.grid||null, s.radius||null, s.unit||null, !!s.circular, s.source||null,
         JSON.stringify(s.metrics||{}), JSON.stringify(s.results||[]), JSON.stringify(s.comps||[])]);
      return send(res, 201, { scan: row });
    }
    if(req.method === 'DELETE'){
      const id = query(req).get('id'); if(!id) return send(res, 400, { error:'id required' });
      await q('delete from scans where id=$1 and owner=$2', [id, owner]);
      return send(res, 200, { ok:true });
    }
    send(res, 405, { error:'method not allowed' });
  } catch(e){ send(res, 500, { error:String(e.message||e) }); }
}
