// Runs a single schedule's scan server-side and stores results. Shared by the
// cron job (api/cron/scan.js) and the manual "Run now" endpoint (api/scan-now.js).
import { q, one } from './db.js';
import { runGridScan } from './serp.js';
import { computeNextRun } from './sched.js';
import { sendAlertEmail } from './email.js';

function arpNum(m){ const a = parseFloat(m && m.arp); return isNaN(a) ? null : a; }

export function providerKey(provider){
  if(provider==='serper') return process.env.SERPER_KEY;
  if(provider==='serpapi') return process.env.SERPAPI_KEY;
  if(provider==='dataforseo') return process.env.DATAFORSEO_KEY;
  return null;
}

export async function runScheduleScan(s, { scanFn = runGridScan, sendFn = sendAlertEmail, reschedule = true, now = Date.now() } = {}){
  const biz = await one('select * from businesses where id=$1', [s.business_id]);
  if(!biz || biz.latitude==null || biz.longitude==null) return { schedule:s.id, skipped:'no business/center' };
  const kws = await q("select keyword from keywords where business_id=$1 and status='active'", [s.business_id]);
  const list = s.scan_all ? kws.map(k=>k.keyword) : kws.slice(0,1).map(k=>k.keyword);
  if(!list.length) return { schedule:s.id, skipped:'no keywords' };
  const key = providerKey(s.provider);
  if(!key) return { schedule:s.id, skipped:'no '+s.provider+' key in env (set '+s.provider.toUpperCase()+'_KEY in Vercel)' };
  const radiusMi = s.unit==='km' ? Number(s.radius)*0.621371 : Number(s.radius);
  const drop = Math.max(1, parseFloat(process.env.ALERT_DROP || '3') || 3);
  let done=0, errored=0; const alerts=[];
  for(const kw of list){
    try{
      // previous metrics for this keyword (before inserting the new scan)
      const prevRow = await one('select metrics from scans where business_id=$1 and keyword=$2 order by created_at desc limit 1', [s.business_id, kw]);
      const prevArp = prevRow ? arpNum(prevRow.metrics) : null;
      const data = await scanFn({ provider:s.provider, key, biz:biz.name, kw, center:{lat:+biz.latitude,lng:+biz.longitude}, grid:s.grid, radiusMi });
      await one(`insert into scans(owner,business_id,keyword,center_lat,center_lng,grid,radius,unit,circular,source,metrics,results,comps)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [s.owner, s.business_id, kw, +biz.latitude, +biz.longitude, s.grid, s.radius, s.unit, s.circular, s.provider,
         JSON.stringify(data.metrics), JSON.stringify(data.results), JSON.stringify(data.comps)]);
      done++;
      // alert when average rank worsened by >= threshold (higher rank number = worse)
      const newArp = arpNum(data.metrics);
      if(prevArp!=null && newArp!=null && (newArp - prevArp) >= drop){
        alerts.push({ keyword:kw, prev:prevArp, now:newArp, note:`worsened by ${(newArp-prevArp).toFixed(1)} positions` });
      } else if(prevArp!=null && newArp==null){
        alerts.push({ keyword:kw, prev:prevArp, now:'not found', note:'dropped out of the top 20' });
      }
    }catch(e){ errored++; }
  }
  if(reschedule) await one('update schedules set last_run=now(), next_run=to_timestamp($2/1000.0) where id=$1 returning id', [s.id, Date.parse(computeNextRun(s.frequency, now))]);
  else await one('update schedules set last_run=now() where id=$1 returning id', [s.id]);
  let emailed=false;
  if(alerts.length){ try{ const r = await sendFn(alerts, biz.name); emailed = !!(r && r.sent); }catch(e){} }
  return { schedule:s.id, business:biz.name, keywords:list.length, done, errored, alerts:alerts.length, emailed };
}
