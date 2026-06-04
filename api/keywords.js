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
      const rows = bid
        ? await q('select * from keywords where owner=$1 and business_id=$2 order by created_at', [owner, bid])
        : await q('select * from keywords where owner=$1 order by created_at', [owner]);
      return send(res, 200, { keywords: rows });
    }
    if(req.method === 'POST'){
      const b = await readJson(req);
      const list = Array.isArray(b.keywords) ? b.keywords : (b.keyword ? [b.keyword] : []);
      if(!b.business_id || !list.length) return send(res, 400, { error:'business_id and keyword(s) required' });
      const out = [];
      for(const kw of list){
        const row = await one('insert into keywords(owner,business_id,keyword,intent,category,target_page,priority,status,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',
          [owner, b.business_id, String(kw), b.intent||null, b.category||null, b.target_page||null, b.priority||3, b.status||'active', b.notes||null]);
        out.push(row);
      }
      return send(res, 201, { keywords: out });
    }
    if(req.method === 'DELETE'){
      const id = query(req).get('id'); if(!id) return send(res, 400, { error:'id required' });
      await q('delete from keywords where id=$1 and owner=$2', [id, owner]);
      return send(res, 200, { ok:true });
    }
    send(res, 405, { error:'method not allowed' });
  } catch(e){ send(res, 500, { error:String(e.message||e) }); }
}
