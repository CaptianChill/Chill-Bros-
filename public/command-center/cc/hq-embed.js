/* Chill Pros HQ inside the Command Center.
   Every HQ screen opens full-size right here (same site, same sign-in), so every HQ workflow keeps working:
   adding and checking off items, chat and calls, files, AI, the food truck, GIBAM projects, money owed.
   HQ remembers its tab and owner-view on this device; we pick the tab, open HQ's classic tabs view inside,
   then put Brae's own HQ setting back so opening HQ directly still looks the way he left it. */
window.BB_HQVIEW = (() => {
  'use strict';
  if (document.documentElement.dataset.hq !== '1' || !window.BB_HQ) return null;
  const TABS = [
    ['today', 'Today'], ['projects', 'GIBAM'], ['money', 'Money'], ['owed', 'Owed'], ['plan', 'Plan'], ['goals', 'Goals'],
    ['cal', 'Schedule'], ['chat', 'Chat'], ['truck', 'Truck'], ['ideas', 'Ideas'], ['notes', 'Notes']
  ];
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };

  const wrap = document.createElement('section');
  wrap.className = 'hqv';
  wrap.hidden = true;
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'Chill Pros HQ');
  wrap.innerHTML = `<header class="hqv-top"><button type="button" class="hqv-back" aria-label="Back to the Command Center">◀ <span>Command Center</span></button>
      <nav class="hqv-tabs" aria-label="HQ sections">${TABS.map(([k, l]) => `<button type="button" data-hqtab="${k}">${l}</button>`).join('')}</nav></header>
    <div class="hqv-body"><div class="hqv-load">Opening HQ…</div><iframe class="hqv-frame" title="Chill Pros HQ" allow="microphone; camera; clipboard-write; fullscreen"></iframe></div>`;
  document.body.appendChild(wrap);
  const frame = wrap.querySelector('iframe'), loadEl = wrap.querySelector('.hqv-load');
  let current = 'today', loaded = false, ownBefore = null;

  function mark(tab) { wrap.querySelectorAll('[data-hqtab]').forEach(b => b.setAttribute('aria-current', b.dataset.hqtab === tab ? 'page' : 'false')); }

  /* switch tabs inside the already-open HQ without reloading it */
  function clickTab(tab) {
    try {
      const d = frame.contentDocument;
      const b = d && d.querySelector(`[data-act="tab"][data-tab="${tab}"]`);
      if (b) { b.click(); return true; }
    } catch {}
    return false;
  }

  function open(tab) {
    current = TABS.some(t => t[0] === tab) ? tab : 'today';
    mark(current);
    wrap.hidden = false;
    document.body.classList.add('hqv-on');
    if (loaded && clickTab(current)) return;
    ownBefore = ls.get('cphq-own');
    ls.set('cphq-tab', current);
    ls.set('cphq-own', 'classic');
    loaded = false; loadEl.hidden = false;
    frame.src = '/brae?cc=1';
  }
  function close() { wrap.hidden = true; document.body.classList.remove('hqv-on'); }

  frame.addEventListener('load', () => {
    loaded = true; loadEl.hidden = true;
    ls.set('cphq-own', ownBefore); /* keep Brae's own HQ view the way he left it */
    setTimeout(() => clickTab(current), 300);
    /* HQ's own "Command center" links would load the Command Center inside itself: just close instead */
    try { const st = frame.contentDocument.createElement('style'); st.textContent = '#ccLink{display:none!important}'; frame.contentDocument.head.appendChild(st); } catch {}
    try {
      frame.contentDocument.addEventListener('click', e => {
        const a = e.target.closest('a[href*="command-center"], #ccLink, [data-act="ccGo"]');
        if (a) { e.preventDefault(); e.stopPropagation(); close(); }
      }, true);
    } catch {}
  });
  wrap.querySelector('.hqv-back').addEventListener('click', close);
  wrap.querySelector('.hqv-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-hqtab]'); if (!b) return;
    current = b.dataset.hqtab; mark(current);
    if (!clickTab(current)) open(current);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.hidden) close(); });
  return { open, close };
})();
