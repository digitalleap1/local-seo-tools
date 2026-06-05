// Aggregate summary across all businesses for the dashboard overview.
import { dbConfigured, q } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { send } from '../lib/http.js';

function arp(m){ const a = parseFloat(m && m.arp); return isNaN(a) ? null : a; }
function mean(arr){ const v = arr.filter(x=>x!=null); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; }

export default async function handler(req, res){
  const auth = requireAuth(req); if(!auth) return send(res, 401, { error:'unauthorized' });
  if(!dbConfigured()) return send(res, 503, { error:'cloud not configured' });
  const owner = auth.user;
  try {
    const businesses = await q('select id,name,city,latitude,longitude from businesses where owner=$1 order by created_at desc', [owner]);
    const schedules = await q('select * from schedules where owner=$1', [owner]);
    const kwCounts = await q('select business_id, count(*)::int n from keywords where owner=$1 group by business_id', [owner]);
    const totals = {
      businesses: businesses.length,
      keywords: (await q('select count(*)::int n from keywords where owner=$1', [owner]))[0].n,
      scans: (await q('select count(*)::int n from scans where owner=$1', [owner]))[0].n,
      scansWeek: (await q("select count(*)::int n from scans where owner=$1 and created_at > now() - interval '7 days'", [owner]))[0].n,
    };
    const scans = await q('select business_id,keyword,metrics,created_at from scans where owner=$1 order by created_at desc limit 5000', [owner]);

    // group scans by business -> keyword (already newest-first)
    const byBiz = {};
    for(const s of scans){
      (byBiz[s.business_id] = byBiz[s.business_id] || {});
      (byBiz[s.business_id][s.keyword] = byBiz[s.business_id][s.keyword] || []).push(s);
    }
    const kwMap = Object.fromEntries(kwCounts.map(r=>[r.business_id, r.n]));
    const schMap = Object.fromEntries(schedules.map(s=>[s.business_id, s]));

    const rows = businesses.map(b => {
      const kws = byBiz[b.id] || {};
      const latest = [], prev = [];
      let count = 0, last = null;
      for(const kw of Object.keys(kws)){
        const arr = kws[kw];
        count += arr.length;
        if(!last || arr[0].created_at > last) last = arr[0].created_at;
        latest.push(arp(arr[0].metrics));
        if(arr[1]) prev.push(arp(arr[1].metrics));
      }
      const avgNow = mean(latest), avgPrev = mean(prev);
      const sch = schMap[b.id];
      return {
        id: b.id, name: b.name, city: b.city,
        keywords: kwMap[b.id] || 0,
        scans: count,
        avgRank: avgNow!=null ? +avgNow.toFixed(1) : null,
        movement: (avgNow!=null && avgPrev!=null) ? +(avgPrev - avgNow).toFixed(1) : null,
        lastScanAt: last,
        schedule: sch ? { frequency: sch.frequency, enabled: sch.enabled, next_run: sch.next_run, last_run: sch.last_run } : null,
      };
    });
    send(res, 200, { totals, businesses: rows });
  } catch(e){ send(res, 500, { error:String(e.message||e) }); }
}
