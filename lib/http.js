// Small helpers for Node serverless handlers (Vercel + local test server).
export async function readJson(req){
  if(req.body && typeof req.body === 'object') return req.body;
  if(typeof req.body === 'string'){ try { return JSON.parse(req.body); } catch(e){ return {}; } }
  return await new Promise(resolve => {
    let d=''; req.on('data', c=>d+=c);
    req.on('end', ()=>{ try { resolve(d ? JSON.parse(d) : {}); } catch(e){ resolve({}); } });
    req.on('error', ()=> resolve({}));
  });
}
export function send(res, status, obj){
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}
export function query(req){ try { return new URL(req.url, 'http://x').searchParams; } catch(e){ return new URLSearchParams(); } }
