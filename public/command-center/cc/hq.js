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
    /* GIBAM: projects with their tasks (owner, phase, due), owners' load and upcoming meetings. */
    const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
    const dueSort = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || byOrder(a, b);
    const projects = items.filter(i => i.kind === 'project').sort(byOrder);
    const roles = items.filter(i => i.kind === 'role');
    const files = items.filter(i => i.kind === 'file');
    const gibam = projects.map(p => {
      const ts = allT.filter(x => x.projectId === p.id), open = ts.filter(x => !x.done);
      const phases = [];
      ts.slice().sort((a, b) => byOrder(a, b)).forEach(x => { const k = x.phase || 'Tasks'; let ph = phases.find(f => f.name === k); if (!ph) phases.push(ph = { name: k, tasks: [] }); ph.tasks.push({ id: x.id, title: x.title, who: x.owner || '', role: x.role || '', due: x.due || '', done: !!x.done, late: !x.done && !!x.due && x.due < t }); });
      return { id: p.id, title: p.title || 'Project', summary: p.summary || '', target: p.target || '', total: ts.length, done: ts.length - open.length,
        pct: ts.length ? Math.round(100 * (ts.length - open.length) / ts.length) : 0,
        overdue: open.filter(x => x.due && x.due < t).length, next: open.sort(dueSort).slice(0, 3).map(x => ({ title: x.title, who: x.owner || '', due: x.due || '', phase: x.phase || '' })),
        phases, roles: roles.filter(r => r.projectId === p.id).sort(byOrder).map(r => ({ title: r.title || 'Role', who: r.owner || '', mission: r.mission || '' })),
        files: files.filter(f => f.projectId === p.id).length };
    });
    const owners = {};
    openT.forEach(x => { const o = x.owner || 'Unassigned'; owners[o] = owners[o] || { who: o, open: 0, late: 0 }; owners[o].open++; if (x.due && x.due < t) owners[o].late++; });
    const meetings = items.filter(i => i.kind === 'event' && i.date && i.date >= t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 6)
      .map(e => ({ title: e.title || 'Meeting', date: e.date, time: e.time || '', project: (projects.find(p => p.id === e.projectId) || {}).title || '' }));
    return {
      at: Date.now(), display: d.display || 'Brae',
      earned: sum(inc, i => i.amount), earnedToday: sum(inc.filter(i => i.date === t), i => i.amount), income: inc,
      wait: sum(inv, i => i.amount), invoices: inv,
      goals: goals.length, hit: goals.filter(g => g.done).length,
      tasks: allT.length, doneT: allT.length - openT.length, gibamPct: allT.length ? Math.round(100 * (allT.length - openT.length) / allT.length) : 0,
      open: steps.length + openT.length, late, soon, ventures,
      gibam, owners: Object.values(owners).sort((a, b) => b.late - a.late || b.open - a.open), meetings
    };
  }
  let RAW = {};
  async function pull() {
    const d = await rpc('hq_pull', { p_token: S.token });
    if (d && d.error === 'auth') { try { localStorage.removeItem('cphq'); } catch {} signIn(); throw new Error('auth'); }
    RAW = {}; (d.items || []).forEach(r => { RAW[r.id] = { board: r.board, kind: r.kind, data: r.data || {} }; });
    return stats(d);
  }
  /** Check a GIBAM task off (or back on) in HQ itself: same hq_put HQ uses, so the team sees it at once. */
  async function setTaskDone(id, done) {
    const r = RAW[id]; if (!r || r.kind !== 'task') throw new Error('Task not found. Refresh and try again.');
    const data = Object.assign({}, r.data, { done: !!done, doneAt: done ? todayStr() : null });
    const res = await rpc('hq_put', { p_token: S.token, p_id: id, p_board: r.board, p_kind: r.kind, p_data: data });
    if (res && res.error === 'auth') { signIn(); throw new Error('auth'); }
    if (!res || !res.ok) throw new Error(res && res.error === 'forbidden' ? 'HQ says you can\u2019t change that one.' : 'Couldn\u2019t save. Try again.');
    r.data = data;
    return true;
  }
  return { token: S.token, pull, signIn, setTaskDone };
})();
