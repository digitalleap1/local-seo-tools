import { dbConfigured, q } from '../lib/db.js';
import { send } from '../lib/http.js';
export default async function handler(req, res){
  if(!dbConfigured()) return send(res, 200, { configured:false, db:false, message:'Cloud disabled — DATABASE_URL not set. Using local storage.' });
  try { await q('select 1 as ok'); send(res, 200, { configured:true, db:true }); }
  catch(e){ send(res, 200, { configured:true, db:false, error:String(e.message||e) }); }
}
