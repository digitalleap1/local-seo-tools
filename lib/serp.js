// Server-side geo-grid scan engine used by the cron job. Mirrors the browser
// providers (Serper / SerpAPI / DataForSEO Maps) using global fetch (Node 18+).
function norm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,''); }
function matchBiz(title, biz){ const a=norm(title), b=norm(biz); if(!a||!b) return false; return a.indexOf(b)>=0 || b.indexOf(a)>=0; }
function placesToResult(places, biz){
  let rank=0;
  for(let i=0;i<places.length;i++){ if(matchBiz(places[i].name, biz)){ rank=i+1; break; } }
  if(rank>20) rank=0;
  return { rank, top: places.slice(0,3).map(p=>p.name) };
}
export function buildGrid(center, n, radiusMi){
  const half=(n-1)/2||1;
  const latStep=(radiusMi/69)/half;
  const lngStep=(radiusMi/(69*Math.cos(center.lat*Math.PI/180)||1))/half;
  const pts=[];
  for(let r=0;r<n;r++) for(let c=0;c<n;c++)
    pts.push({ r, c, lat: center.lat+((n-1)/2-r)*latStep, lng: center.lng+(c-(n-1)/2)*lngStep });
  return pts;
}
function zoomFor(radiusMi){ return radiusMi>8?11:radiusMi>4?12:radiusMi>2?13:14; }

async function serper(kw,lat,lng,biz,key,z){
  const r=await fetch('https://google.serper.dev/maps',{method:'POST',headers:{'X-API-KEY':key,'Content-Type':'application/json'},body:JSON.stringify({q:kw,ll:`@${lat.toFixed(6)},${lng.toFixed(6)},${z}z`})});
  if(!r.ok) throw new Error('Serper '+r.status);
  const j=await r.json();
  return placesToResult((j.places||[]).map(p=>({name:p.title})), biz);
}
async function serpapi(kw,lat,lng,biz,key,z){
  const u=`https://serpapi.com/search.json?engine=google_maps&type=search&q=${encodeURIComponent(kw)}&ll=@${lat.toFixed(6)},${lng.toFixed(6)},${z}z&api_key=${encodeURIComponent(key)}`;
  const r=await fetch(u); if(!r.ok) throw new Error('SerpAPI '+r.status);
  const j=await r.json(); if(j.error) throw new Error('SerpAPI: '+j.error);
  const lr=j.local_results||(j.place_results?[j.place_results]:[]);
  return placesToResult((Array.isArray(lr)?lr:[]).map(p=>({name:p.title})), biz);
}
async function dataforseo(kw,lat,lng,biz,cred,radiusKm){
  const body=[{keyword:kw,language_code:'en',device:'desktop',depth:20,location_coordinate:`${lat.toFixed(6)},${lng.toFixed(6)},${radiusKm.toFixed(2)}`}];
  const r=await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced',{method:'POST',headers:{'Authorization':'Basic '+Buffer.from(cred).toString('base64'),'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('DataForSEO '+r.status);
  const j=await r.json();
  const items=((((j.tasks||[])[0]||{}).result||[])[0]||{}).items||[];
  const places=items.filter(it=>it&&it.title!=null&&it.rank_absolute!=null).sort((a,b)=>a.rank_absolute-b.rank_absolute).map(it=>({name:it.title}));
  return placesToResult(places, biz);
}

function metrics(results){
  const found=results.filter(r=>r.rank>0);
  const arp=found.length?(found.reduce((a,r)=>a+r.rank,0)/found.length):0;
  const t3=results.filter(r=>r.rank>0&&r.rank<=3).length;
  const t10=results.filter(r=>r.rank>0&&r.rank<=10).length;
  return { arp: arp?+arp.toFixed(1):0, solv: results.length?Math.round(t3/results.length*100):0,
    cov: results.length?Math.round(found.length/results.length*100):0, t3, t10, found: found.length, total: results.length };
}

// Runs a full grid scan server-side and returns {results, comps, metrics}.
export async function runGridScan({ provider, key, biz, kw, center, grid, radiusMi }){
  const pts=buildGrid(center, grid, radiusMi);
  const z=zoomFor(radiusMi);
  const radiusKm=Math.max(0.5, Math.min(50, (radiusMi/((grid-1)/2||1))*1.60934));
  const results=[]; const tally={};
  for(const p of pts){
    let res;
    try{
      if(provider==='serper') res=await serper(kw,p.lat,p.lng,biz,key,z);
      else if(provider==='serpapi') res=await serpapi(kw,p.lat,p.lng,biz,key,z);
      else if(provider==='dataforseo') res=await dataforseo(kw,p.lat,p.lng,biz,key,radiusKm);
      else throw new Error('unknown provider');
    }catch(e){ if(results.length===0) throw e; res={rank:0,top:[]}; }
    (res.top||[]).forEach(n=>{ if(!matchBiz(n,biz)) tally[n]=(tally[n]||0)+1; });
    results.push({ r:p.r, c:p.c, lat:p.lat, lng:p.lng, rank:res.rank, top:res.top||[] });
    await new Promise(r=>setTimeout(r,140));
  }
  const comps=Object.keys(tally).sort((a,b)=>tally[b]-tally[a]).slice(0,12);
  return { results, comps, metrics: metrics(results) };
}
export { metrics };
