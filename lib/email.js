// Optional email alerts via Resend (free 3k/mo). Activates only when RESEND_KEY
// and ALERT_EMAIL are set in Vercel; otherwise it's a graceful no-op.
// ALERT_FROM defaults to Resend's shared test sender (works without a verified
// domain when sending to your own address).
export async function sendAlertEmail(alerts, bizName){
  const key = process.env.RESEND_KEY, to = process.env.ALERT_EMAIL;
  const from = process.env.ALERT_FROM || 'onboarding@resend.dev';
  if(!key || !to || !alerts || !alerts.length) return { skipped:true };
  const rows = alerts.map(a =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(a.keyword)}</td>`+
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace">${esc(a.prev)} → <b style="color:#dc2626">${esc(a.now)}</b></td>`+
    `<td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(a.note)}</td></tr>`).join('');
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">`+
    `<h2 style="color:#0f1a2e">Local rank drop — ${esc(bizName)}</h2>`+
    `<p style="color:#5b6b88">Your latest scheduled geo-grid scan detected ranking drops:</p>`+
    `<table style="width:100%;border-collapse:collapse;font-size:14px"><tr>`+
    `<th style="text-align:left;padding:6px 10px;color:#8a9ab5">Keyword</th>`+
    `<th style="text-align:left;padding:6px 10px;color:#8a9ab5">Avg rank</th>`+
    `<th style="text-align:left;padding:6px 10px;color:#8a9ab5">Detail</th></tr>${rows}</table>`+
    `<p style="color:#8a9ab5;font-size:12px;margin-top:18px">Geo-Grid Rank Tracker · open the Cloud Rank Dashboard for heatmaps & trends.</p></div>`;
  try{
    const r = await fetch('https://api.resend.com/emails', {
      method:'POST', headers:{ 'Authorization':'Bearer '+key, 'Content-Type':'application/json' },
      body: JSON.stringify({ from, to, subject:`📉 Rank drop alert — ${bizName}`, html }),
    });
    return { sent:r.ok, status:r.status };
  }catch(e){ return { error:String(e.message||e) }; }
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
