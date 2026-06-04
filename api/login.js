/* Edge function — verifies admin credentials and issues a signed session cookie.
 * Credentials come from Vercel environment variables (never hard-coded):
 *   AUTH_USER (default "admin"), AUTH_PASS, AUTH_SECRET                       */
export const config = { runtime: 'edge' };

const enc = new TextEncoder();
function b64urlBytes(bytes){ let s=''; for(const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64urlStr(str){ return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
async function hmac(data, secret){
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlBytes(new Uint8Array(sig));
}
async function makeToken(u, secret){
  const payload = b64urlStr(JSON.stringify({ u, exp: Date.now() + 7 * 24 * 3600 * 1000 }));
  return payload + '.' + await hmac(payload, secret);
}
function ctEq(a, b){
  if(typeof a !== 'string' || typeof b !== 'string') return false;
  let m = a.length === b.length ? 0 : 1;
  const n = Math.max(a.length, b.length);
  for(let i = 0; i < n; i++) m |= ((a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0));
  return m === 0;
}
function json(obj, status){ return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } }); }

export default async function handler(req){
  if(req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = process.env.AUTH_SECRET;
  const USER = process.env.AUTH_USER || 'admin';
  const PASS = process.env.AUTH_PASS;
  if(!secret || !PASS) return json({ error: 'Login is not configured yet. Set AUTH_PASS and AUTH_SECRET in Vercel → Settings → Environment Variables.' }, 503);

  let body = {};
  try { body = await req.json(); }
  catch(e){ try { const f = await req.formData(); body = { username: f.get('username'), password: f.get('password') }; } catch(_){} }
  const username = (body.username || '').trim();
  const password = body.password || '';
  if(username !== USER || !ctEq(password, PASS)) return json({ error: 'Invalid username or password.' }, 401);

  const token = await makeToken(USER, secret);
  const cookie = `sb_auth=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`;
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': cookie } });
}
