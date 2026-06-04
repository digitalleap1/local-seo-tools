// Shared schedule helpers.
export function computeNextRun(freq, from){
  const d = new Date(from);
  if(freq==='daily') d.setDate(d.getDate()+1);
  else if(freq==='weekly') d.setDate(d.getDate()+7);
  else if(freq==='monthly') d.setMonth(d.getMonth()+1);
  else return null;
  return d.toISOString();
}
