// Vercel Cron entry (free, daily). Runs every enabled schedule whose next_run is
// due, server-side, and stores the results. Provider API keys come from env vars
// (SERPER_KEY / SERPAPI_KEY / DATAFORSEO_KEY) since cron has no browser session.
//
// To allow only Vercel Cron (recommended): set CRON_SECRET in Vercel; Vercel sends
// `Authorization: Bearer <CRON_SECRET>`. If CRON_SECRET is unset, runs unauthenticated.
import { dbConfigured, q, one } from '../../lib/db.js';
import { runGridScan } from '../../lib/serp.js';
import { computeNextRun } from '../schedules.js';
import { send } from '../../lib/http.js';

function providerKey(provider){
  if(provider==='serper') return process.env.SERPER_KEY;
  if(provider==='serpapi') return process.env.SERPAPI_KEY;
  if(provider==='dataforseo') return process.env.DATAFORSEO_KEY;
  return null;
}

// Exposed so tests can inject a fake scanner; defaults to the real one.
export async function runDueSchedules(scanFn = runGridScan, now = Date.now()){
  const due = await q('select * from schedules where enabled = true and next_run is not null and next_run <= to_timestamp($1/1000.0) order by next_run', [now]);
  const summary = [];
  for(const s of due){
    const biz = await one('select * from businesses where id=$1', [s.business_id]);
    if(!biz || biz.latitude==null || biz.longitude==null){ summary.push({ schedule:s.id, skipped:'no business/center' }); continue; }
    const kws = await q('select keyword from keywords where business_id=$1 and status=\'active\'', [s.business_id]);
    const list = s.scan_all ? kws.map(k=>k.keyword) : kws.slice(0,1).map(k=>k.keyword);
    const key = providerKey(s.provider);
    if(!key && s.provider!=='demo'){ summary.push({ schedule:s.id, skipped:'no '+s.provider+' key in env' }); continue; }
    const radiusMi = s.unit==='km' ? Number(s.radius)*0.621371 : Number(s.radius);
    let done=0, errored=0;
    for(const kw of list){
      try{
        const data = await scanFn({ provider:s.provider, key, biz:biz.name, kw, center:{lat:+biz.latitude,lng:+biz.longitude}, grid:s.grid, radiusMi });
        await one(`insert into scans(owner,business_id,keyword,center_lat,center_lng,grid,radius,unit,circular,source,metrics,results,comps)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
          [s.owner, s.business_id, kw, +biz.latitude, +biz.longitude, s.grid, s.radius, s.unit, s.circular, s.provider,
           JSON.stringify(data.metrics), JSON.stringify(data.results), JSON.stringify(data.comps)]);
        done++;
      }catch(e){ errored++; }
    }
    await one('update schedules set last_run=now(), next_run = to_timestamp($2/1000.0) where id=$1 returning id',
      [s.id, Date.parse(computeNextRun(s.frequency, now))]);
    summary.push({ schedule:s.id, business:biz.name, keywords:list.length, done, errored });
  }
  return summary;
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
