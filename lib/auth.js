// Verifies the same HMAC-signed `sb_auth` session cookie issued by api/login.js.
// If AUTH_SECRET is not configured, the site runs open (matches the middleware),
// so the API stays usable until the admin turns on the login gate.
import crypto from 'crypto';

function b64url(buf){ return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function unb64urlStr(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return Buffer.from(s,'base64').toString('utf8'); }
function hmac(data, secret){ return b64url(crypto.createHmac('sha256', secret).update(data).digest()); }

export function verifyToken(token, secret){
  if(!token || typeof token!=='string') return null;
  const i = token.lastIndexOf('.'); if(i < 1) return null;
  const payload = token.slice(0, i), sig = token.slice(i+1);
  const exp = hmac(payload, secret);
  if(exp.length !== sig.length) return null;
  try { if(!crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(sig))) return null; } catch(e){ return null; }
  try { const o = JSON.parse(unb64urlStr(payload)); if(typeof o.exp==='number' && o.exp > Date.now()) return o; } catch(e){}
  return null;
}
export function getCookie(header, name){
  if(!header) return null;
  for(const part of header.split(/;\s*/)){ const eq = part.indexOf('='); if(eq>0 && part.slice(0,eq)===name) return part.slice(eq+1); }
  return null;
}
// Returns {user} when authorized, or null. Open when AUTH_SECRET unset.
export function requireAuth(req){
  const secret = process.env.AUTH_SECRET;
  if(!secret) return { user: 'admin' };
  const header = (req.headers && (req.headers.cookie || (req.headers.get && req.headers.get('cookie')))) || '';
  const o = verifyToken(getCookie(header, 'sb_auth'), secret);
  return o ? { user: o.u || 'admin' } : null;
}
