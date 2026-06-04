// Vercel Cron entry (free, daily). Runs every enabled schedule whose next_run is
// due, server-side, and stores the results. Provider API keys come from env vars
// (SERPER_KEY / SERPAPI_KEY / DATAFORSEO_KEY) since cron has no browser session.
//
// To allow only Vercel Cron (recommended): set CRON_SECRET in Vercel; Vercel sends
// `Authorization: Bearer <CRON_SECRET>`. If CRON_SECRET is unset, runs unauthenticated.
import { dbConfigured, q } from '../../lib/db.js';
import { runScheduleScan } from '../../lib/runner.js';
import { send } from '../../lib/http.js';

// Exposed so tests can inject a fake scanner; defaults to the real one.
export async function runDueSchedules(scanFn, now = Date.now()){
  const due = await q('select * from schedules where enabled = true and next_run is not null and next_run <= to_timestamp($1/1000.0) order by next_run', [now]);
  const out = [];
  for(const s of due) out.push(await runScheduleScan(s, { scanFn, reschedule:true, now }));
  return out;
}

export default async function handler(req, res){
  const secret = process.env.CRON_SECRET;
  if(secret){
    const hdr = (req.headers.authorization || (req.headers.get && req.headers.get('authorization')) || '');
    if(hdr !== 'Bearer '+secret) return send(res, 401, { error:'unauthorized' });
  }
  if(!dbConfigured()) return send(res, 200, { ran:0, message:'DATABASE_URL not set — nothing to do' });
  try {
    const summary = await runDueSchedules();
    send(res, 200, { ran: summary.length, summary });
  } catch(e){ send(res, 500, { error:String(e.message||e) }); }
}
