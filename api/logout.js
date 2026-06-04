/* Edge function — clears the session cookie (sign out). */
export const config = { runtime: 'edge' };

export default async function handler(){
  const cookie = 'sb_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': cookie } });
}
