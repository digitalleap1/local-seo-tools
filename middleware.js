/* ==========================================================================
 * VERCEL EDGE MIDDLEWARE — Admin login gate (server-side, unbypassable)
 *
 * Runs at the edge BEFORE any page is served. An unauthenticated request is
 * redirected to /login.html and never receives the tool HTML — so the gate
 * cannot be bypassed by disabling JavaScript, editing the page, or opening a
 * tool file directly.
 *
 * ACTIVATION: stays OFF (fails open) until you set the environment variables
 * in Vercel → Project → Settings → Environment Variables:
 *     AUTH_SECRET  — a long random string (used to sign sessions)
 *     AUTH_PASS    — the admin password
 *     AUTH_USER    — admin username (optional; defaults to "admin")
 * The moment AUTH_SECRET is set, the login gate is enforced on every request.
 * ========================================================================== */
export const config = {
  matcher: ['/((?!login|api/|favicon.ico|robots.txt|sitemap.xml|_vercel).*)'],
};

const enc = new TextEncoder();
function b64urlBytes(bytes){ let s=''; for(const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function unb64urlStr(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
async function hmac(data, secret){
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlBytes(new Uint8Array(sig));
}
async function verifyToken(token, secret){
  if(!token || typeof token !== 'string') return false;
  const i = token.lastIndexOf('.'); if(i < 1) return false;
  const payload = token.slice(0, i), sig = token.slice(i + 1);
  const expSig = await hmac(payload, secret);
  if(expSig.length !== sig.length) return false;
  let diff = 0; for(let k = 0; k < expSig.length; k++) diff |= expSig.charCodeAt(k) ^ sig.charCodeAt(k);
  if(diff !== 0) return false;
  try { const o = JSON.parse(unb64urlStr(payload)); return typeof o.exp === 'number' && o.exp > Date.now(); }
  catch(e){ return false; }
}
function getCookie(header, name){
  if(!header) return null;
  for(const part of header.split(/;\s*/)){ const eq = part.indexOf('='); if(eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1); }
  return null;
}

export default async function middleware(req){
  const secret = process.env.AUTH_SECRET;
  if(!secret) return; // not configured yet → fail open (site keeps working)
  const token = getCookie(req.headers.get('cookie'), 'sb_auth');
  if(await verifyToken(token, secret)) return; // authenticated → serve normally
  const url = new URL(req.url);
  const next = encodeURIComponent(url.pathname + url.search);
  return Response.redirect(new URL('/login.html?next=' + next, req.url), 307);
}
