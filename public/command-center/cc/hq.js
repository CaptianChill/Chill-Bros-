/* Chill Pros HQ bridge: when the Command Center runs inside HQ (chill-pros-hq.vercel.app/command-center),
   it uses Brae's HQ sign-in and pulls HQ's live boards (money, GIBAM tasks, goals, overdue work).
   Same numbers HQ's own owner view shows. Nothing is written back from here. */
window.BB_HQ = (() => {
  'use strict';
  if (document.documentElement.dataset.hq !== '1') return null;
  const SB = 'https://rbhtdgqpktocavxbiafw.supabase.co';
  const KEY = 'sb_publishable_QmdOKzwUgIFM8MfZWdpeBw_8CefyFOz';
  let S = null;
  try { S = JSON.parse(localStorage.getItem('cphq') || 'null'); } catch { S = null; }
  if (!S || S.name !== 'brae' || !S.token) return null;

  const signIn = () => { try { sessionStorage.setItem('cphq-next', 'cc'); } catch {} location.replace('/brae'); };
  async function rpc(fn, args) {
    const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error('network');
    return r.json();
  }
  const pad = n => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const daysUntil = s => Math.round((new Date(s + 'T00:00') - new Date(todayStr() + 'T00:00')) / 86400000);
  const sum = (a, f) => a.reduce((s, i) => s + (+f(i) || 0), 0);

  /** Same math as HQ's owner command center (ccStats), across every board Brae can see. */
  function stats(d) {
    const items = (d.items || []).map(r => ({ ...r.data, id: r.id, board: r.board, kind: r.kind, _at: r.updated_at }));
    const t = todayStr();
    const inc = items.filter(i => i.kind === 'income');
    const inv = items.filter(i => i.kind === 'invoice' && i.status !== 'paid');
    const goals = items.filter(i => i.kind === 'goal');
    const allT = items.filter(i => i.kind === 'task'), openT = allT.filter(i => !i.done);
    const steps = items.filter(i => i.kind === 'step' && !i.done);
    const late = [
      ...openT.filter(i => i.due && i.due < t).map(i => ({ title: i.title, who: i.owner || 'GIBAM', due: i.due })),
      ...items.filter(i => i.kind === 'plan' && !i.done && i.due && i.due < t).map(i => ({ title: i.title, who: i.board, due: i.due }))
    ].sort((a, b) => a.due.localeCompare(b.due));
    const soon = items.filter(i => i.kind === 'plan' && !i.done && i.due && i.due >= t && daysUntil(i.due) <= 3).sort((a, b) => a.due.localeCompare(b.due));
    const ventures = items.filter(i => i.kind === 'venture').sort((a, b) => (a.order || 0) - (b.order || 0));
    return {
      at: Date.now(), display: d.display || 'Brae',
      earned: sum(inc, i => i.amount), earnedToday: sum(inc.filter(i => i.date === t), i => i.amount), income: inc,
      wait: sum(inv, i => i.amount), invoices: inv,
      goals: goals.length, hit: goals.filter(g => g.done).length,
      tasks: allT.length, doneT: allT.length - openT.length, gibamPct: allT.length ? Math.round(100 * (allT.length - openT.length) / allT.length) : 0,
      open: steps.length + openT.length, late, soon, ventures
    };
  }
  async function pull() {
    const d = await rpc('hq_pull', { p_token: S.token });
    if (d && d.error === 'auth') { try { localStorage.removeItem('cphq'); } catch {} signIn(); throw new Error('auth'); }
    return stats(d);
  }
  return { token: S.token, pull, signIn };
})();
