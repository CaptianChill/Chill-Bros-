(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const APPS = window.BB_APPS || [];
  const ROUTES = window.BB_ROUTES || {};
  const appById = id => APPS.find(a => a.id === id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('bbcc.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('bbcc.' + k, JSON.stringify(v)); } catch {} }
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Settings ---------------- */
  const settings = Object.assign({ fx: reduced ? 'low' : 'heavy', ntfy: '', look: 'default', appUrls: {} }, store.get('settings', {}));
  APPS.forEach(a => { if (!a.url && settings.appUrls && settings.appUrls[a.id]) a.url = settings.appUrls[a.id]; });
  const BIG = window.BB_BIG || [];
  document.body.dataset.fx = settings.fx;
  const saveSettings = () => { store.set('settings', settings); document.body.dataset.fx = settings.fx; };

  /* ---------------- Avatar look (art variants) ---------------- */
  const LOOKS = window.BB_LOOKS || { default: { desktop: 'cc/desktop.webp', mobile: 'cc/mobile.webp', label: 'Original' } };
  function applyLook() {
    const look = LOOKS[settings.look] || LOOKS.default;
    $$('img[data-art]').forEach(img => { const src = look[img.dataset.art]; if (src && img.getAttribute('src') !== src) img.src = src; });
  }
  applyLook();

  /* ---------------- Clock ---------------- */
  const fTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const fShort = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const fDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const fUpper = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  $$('svg.analog .ticks').forEach(g => {
    let h = '';
    for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180, r1 = i % 3 ? 24 : 21.5, r2 = 27; h += `<line x1="${(Math.sin(a) * r1).toFixed(2)}" y1="${(-Math.cos(a) * r1).toFixed(2)}" x2="${(Math.sin(a) * r2).toFixed(2)}" y2="${(-Math.cos(a) * r2).toFixed(2)}"/>`; }
    g.innerHTML = h;
  });
  function tick() {
    const now = new Date();
    $$('[data-clock="time"]').forEach(e => e.textContent = fTime.format(now));
    $$('[data-clock="short"]').forEach(e => e.textContent = fShort.format(now));
    $$('[data-clock="date"]').forEach(e => e.textContent = fDate.format(now));
    $$('[data-clock="upper"]').forEach(e => e.textContent = fUpper.format(now).toUpperCase());
    const s = now.getSeconds(), m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
    $$('svg.analog').forEach(svg => {
      svg.querySelector('.h-hour').setAttribute('transform', `rotate(${h * 30})`);
      svg.querySelector('.h-min').setAttribute('transform', `rotate(${m * 6})`);
      svg.querySelector('.h-sec').setAttribute('transform', `rotate(${s * 6})`);
    });
  }
  tick(); setInterval(tick, 1000);

  /* ---------------- App icons ---------------- */
  const GLYPH = {
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    crown: '<path d="M3 18h18l-1.5-10-4.5 4-3-6-3 6L4.5 8z" fill="#fff"/><rect x="3" y="19" width="18" height="2" rx="1" fill="#fff"/>',
    ball: '<circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="1.8" fill="none"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="#fff" stroke-width="1.5" fill="none"/>',
    chart: '<path d="M3 20h18M5 16l4-5 4 3 6-8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19" cy="6" r="2" fill="#fff"/>',
    anvil: '<path d="M3 7h14c0 3-2 4-5 4v3h3v3H7v-3h3v-3C6 11 4 9 3 7z" fill="#fff"/><path d="M17 7h4" stroke="#fff" stroke-width="2"/>',
    doc: '<path d="M6 2h9l4 4v16H6z" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M9 10h7M9 14h7M9 18h4" stroke="#fff" stroke-width="1.6"/>',
    dollar: '<path d="M12 2v20M17 6.5C16 5 14.3 4.5 12 4.5c-3 0-4.6 1.5-4.6 3.4 0 4.6 9.6 2.4 9.6 7.6 0 2-1.8 3.6-5 3.6-2.6 0-4.3-.8-5.3-2.4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>',
    smile: '<circle cx="12" cy="12" r="9" fill="#ffe14d"/><circle cx="9" cy="10" r="1.3" fill="#3a2a00"/><circle cx="15" cy="10" r="1.3" fill="#3a2a00"/><path d="M7.5 13.5h9c-.8 2.6-2.5 4-4.5 4s-3.7-1.4-4.5-4z" fill="#fff" stroke="#3a2a00" stroke-width=".8"/>',
    coin: '<circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="1.8" fill="none"/><path d="M10 7.5h3.2a2.3 2.3 0 0 1 0 4.5H10m0 0h3.6a2.3 2.3 0 0 1 0 4.5H10m0-9v9M11 6v1.5M11 16.5V18" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="#fff" stroke-width="1.8" fill="none"/><path d="M2.5 9.5h19" stroke="#fff" stroke-width="2.4"/><path d="M6 15h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    spark: '<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#fff"/>'
  };
  const health = {};
  const iconOf = a => a.img ? `<img src="${esc(a.img)}" alt="" loading="lazy" decoding="async">` : `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[a.glyph] || GLYPH.spark}</svg>`;
  function tileHTML(a, withLabel) {
    const st = !a.url ? 'setup' : health[a.id] || (a.local ? 'local' : '');
    return `<button type="button" class="app-tile${withLabel ? ' has-lbl' : ''}" style="--c:${a.color}" data-go="app:${a.id}" title="${esc(a.name)}" aria-label="Open ${esc(a.name)}">
      ${iconOf(a)}
      ${withLabel ? `<span class="lbl">${esc(a.short)}</span>` : ''}<span class="dot ${st}"></span></button>`;
  }
  const stateOf = a => !a.url ? 'setup' : health[a.id] || (a.local ? 'local' : '');
  const projHTML = a => `<button type="button" class="proj" style="--c:${a.color}" data-go="app:${a.id}" title="${esc(a.name)}"><span class="pi${a.img ? ' has-img' : ''}">${iconOf(a)}</span><span class="pn">${esc(a.name)}</span><span class="dot ${stateOf(a)}"></span></button>`;
  const moneyFmt = v => `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: v >= 1000 || v <= -1000 ? 0 : 2 })}`;
  function bigHTML(a, sub) {
    const m = money.apps[a.id];
    const max = Math.max(1, ...Object.values(money.apps).map(x => Math.abs(x.value || 0)));
    let figure;
    if (m && m.value != null) figure = `<span class="bm ${m.value < 0 ? 'neg' : ''}">${moneyFmt(m.value)}<em>${esc(m.label)}</em></span><span class="bsub">${esc(m.sub)}</span><span class="bar"><i style="width:${Math.max(3, Math.abs(m.value) / max * 100).toFixed(1)}%"></i></span>`;
    else if (m) figure = `<span class="bm muted">—</span><span class="bsub">${esc(m.sub)}</span><span class="bar"></span>`;
    else if (money.state === 'signin' && (a.id === 'crm' || a.id === 'bbb')) figure = `<span class="bm muted">$ —</span><span class="bsub">Sign in to Chill Pros to see money</span><span class="bar"></span>`;
    else figure = `<span class="bm muted">—</span><span class="bsub">${a.url ? 'No money feed yet' : 'Tap to add its link'}</span><span class="bar"></span>`;
    return `<button type="button" class="big-tile" style="--c:${a.color}" data-go="app:${a.id}" aria-label="Open ${esc(a.name)}"><span class="bt"><span class="bi${a.img ? ' has-img' : ''}">${iconOf(a)}</span><span class="bn"><b>${esc(a.short === 'CRM' ? 'Chill Pros' : a.short)}</b><small>${esc(sub || a.name)}</small></span><span class="dot ${stateOf(a)}"></span></span>${figure}</button>`;
  }
  function renderApps() {
    $$('[data-apps="list"]').forEach(el => el.innerHTML = APPS.map(projHTML).join(''));
    $$('[data-apps="big"]').forEach(el => el.innerHTML = BIG.map(b => { const a = appById(b.id); return a ? bigHTML(a, b.sub) : ''; }).join(''));
    $$('[data-apps="mini"]').forEach(el => el.innerHTML = APPS.slice(0, 9).map(a => tileHTML(a, false)).join(''));
    $$('[data-apps="dock"]').forEach(el => el.innerHTML = APPS.map(a => tileHTML(a, true)).join(''));
    $$('[data-stat="apps"]').forEach(e => e.textContent = APPS.length);
  }
  /* ---------------- Money per app (owner-only API on this same site; real figures only) ---------------- */
  const money = { state: 'loading', apps: {} };
  async function loadMoney() {
    try {
      const r = await fetch('/api/command-center/profits', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' });
      if (r.type === 'opaqueredirect' || r.status === 401 || r.status === 307 || r.status === 302) { money.state = 'signin'; money.apps = {}; }
      else { const j = await r.json(); if (!j.ok) throw new Error(j.error); money.state = 'live'; money.apps = Object.fromEntries(j.apps.map(x => [x.id, x])); }
    } catch { money.state = 'error'; }
    renderApps();
  }
  renderApps();
  loadMoney(); setInterval(loadMoney, 5 * 60 * 1000);

  /* ---------------- Health checks (real reachability pings) ---------------- */
  async function ping(a) {
    if (!a.url) return 'setup';
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 7000);
    try { await fetch(a.url + (a.url.includes('?') ? '&' : '?') + '_bbcc=' + Date.now(), { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal }); return 'on'; }
    catch { return a.local ? 'local' : 'off'; }
    finally { clearTimeout(t); }
  }
  let lastHealth = null;
  async function checkAll() {
    const prev = { ...health };
    await Promise.all(APPS.map(async a => { health[a.id] = await ping(a); }));
    lastHealth = new Date();
    renderApps();
    const down = APPS.filter(a => health[a.id] === 'off');
    const up = APPS.filter(a => health[a.id] === 'on');
    APPS.forEach(a => {
      if (prev[a.id] && prev[a.id] !== health[a.id] && (health[a.id] === 'off' || prev[a.id] === 'off'))
        pushNotif({ title: health[a.id] === 'off' ? `${a.name} down` : `${a.name} back online`, body: 'App health check', kind: health[a.id] === 'off' ? 'alert' : 'ok', time: Date.now() });
    });
    const cloud = APPS.filter(a => a.url && !(a.local && health[a.id] !== 'on'));
    systemNotif = { title: down.length ? `${down.length} app${down.length > 1 ? 's' : ''} unreachable` : 'All systems online', body: `${up.length}/${cloud.length} cloud apps responding`, kind: down.length ? 'alert' : 'system', time: Date.now() };
    renderNotifs();
  }

  /* ---------------- Notifications (ntfy live feed + system) ---------------- */
  const KIND = {
    project: { c: '#c81e2b', i: '🏠' }, dispatch: { c: '#1d4fd8', i: '🚚' }, tech: { c: '#16a34a', i: '👤' },
    invoice: { c: '#15a34a', i: '🧾' }, system: { c: '#7c3aed', i: '⚙️' }, alert: { c: '#dc2626', i: '⚠️' }, ok: { c: '#16a34a', i: '✅' }, money: { c: '#15803d', i: '💵' }
  };
  let notifs = store.get('notifs', []);
  let systemNotif = null;
  function kindFor(m) {
    const t = ((m.title || '') + ' ' + (m.body || '') + ' ' + (m.tags || []).join(' ')).toLowerCase();
    if (/invoice|paid|payment|deposit|payout|cashed|\$/.test(t)) return 'invoice';
    if (/dispatch|route|assign/.test(t)) return 'dispatch';
    if (/tech|clock|reading/.test(t)) return 'tech';
    if (/approv|quote/.test(t)) return 'project';
    if (/call|lead|new/.test(t)) return 'project';
    if (/fail|down|error|urgent/.test(t)) return 'alert';
    return 'system';
  }
  function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago'; return Math.floor(s / 86400) + ' d ago';
  }
  function pushNotif(n, quiet) {
    if (n.id && notifs.some(x => x.id === n.id)) return;
    notifs.unshift(n); notifs = notifs.slice(0, 60); store.set('notifs', notifs);
    if (!quiet) { renderNotifs(); celebrate(); }
  }
  function allNotifs() { return (systemNotif ? [systemNotif] : []).concat(notifs).sort((a, b) => b.time - a.time); }
  const MONEY_RE = /paid|payment|deposit|received|cashed|won|payout|\$/i;
  const amountOf = n => { const m = ((n.title || '') + ' ' + (n.body || '')).match(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/); return m ? Number(m[1].replace(/,/g, '')) : 0; };
  function renderOps() {
    const top = allNotifs().slice(0, 4);
    $$('[data-feed="notifs"]').forEach(ul => {
      ul.innerHTML = top.length ? top.map(n => { const k = KIND[n.kind] || KIND.system; return `<li><span>${k.i}</span><b>${esc(n.title)}</b><i>${ago(n.time)}</i></li>`; }).join('') : '<li><span>⚙️</span><b>Checking systems</b></li>';
    });
    const today = new Date().toDateString();
    const money = notifs.filter(n => new Date(n.time).toDateString() === today && (n.kind === 'invoice' || n.kind === 'money') && MONEY_RE.test((n.title || '') + ' ' + (n.body || '')));
    const total = money.reduce((sum, n) => sum + amountOf(n), 0);
    $$('[data-money="total"]').forEach(e => e.textContent = '$' + total.toLocaleString(undefined, { maximumFractionDigits: 2 }));
    $$('[data-money="line"]').forEach(e => e.textContent = money.length ? `${money.length} update${money.length > 1 ? 's' : ''} · last: ${money[0].title}` : (settings.ntfy ? 'No payments yet today' : 'Connect alerts in Settings'));
  }
  function renderNotifs() {
    $$('[data-notifs]').forEach(ul => {
      const list = allNotifs().slice(0, ul.dataset.notifs === 'side' ? 12 : 5);
      ul.innerHTML = list.length ? list.map(n => { const k = KIND[n.kind] || KIND.system; return `<li><span class="ic" style="--c:${k.c}">${k.i}</span><div><b>${esc(n.title)}</b><span>${esc(n.body || '')}</span><i>${ago(n.time)}</i></div></li>`; }).join('')
        : `<li><span class="ic" style="--c:#7c3aed">⚙️</span><div><b>Checking systems</b><span>Pinging your apps…</span><i>now</i></div></li>`;
    });
    const today = new Date().toDateString();
    const approvals = notifs.filter(n => new Date(n.time).toDateString() === today && /approv/i.test((n.title || '') + (n.body || ''))).length;
    $$('[data-stat="approvals"]').forEach(e => e.textContent = approvals);
    renderOps();
  }
  renderNotifs();
  setInterval(renderNotifs, 30000);

  let es = null;
  function connectNtfy() {
    if (es) { es.close(); es = null; }
    const topic = (settings.ntfy || '').trim();
    if (!topic) return;
    const base = topic.startsWith('http') ? topic.replace(/\/$/, '') : 'https://ntfy.sh/' + encodeURIComponent(topic);
    fetch(base + '/json?poll=1&since=24h').then(r => r.text()).then(txt => {
      txt.split('\n').filter(Boolean).forEach(line => { try { const m = JSON.parse(line); if (m.event === 'message') pushNotif({ id: m.id, title: m.title || 'Chill Pros', body: m.message, tags: m.tags, kind: kindFor({ title: m.title, body: m.message, tags: m.tags }), time: m.time * 1000 }, true); } catch {} });
      renderNotifs();
    }).catch(() => {});
    try {
      es = new EventSource(base + '/sse');
      es.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.event === 'message') { pushNotif({ id: m.id, title: m.title || 'Chill Pros', body: m.message, tags: m.tags, kind: kindFor({ title: m.title, body: m.message, tags: m.tags }), time: m.time * 1000 }); toast((m.title ? m.title + ': ' : '') + m.message); } } catch {} };
    } catch {}
  }
  connectNtfy();
  checkAll(); setInterval(checkAll, 5 * 60 * 1000);

  /* ---------------- Weather (Open-Meteo, San Antonio) ---------------- */
  const WX = { 0: ['☀️', 'Sunny'], 1: ['🌤️', 'Mostly sunny'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Cloudy'], 45: ['🌫️', 'Fog'], 48: ['🌫️', 'Fog'], 51: ['🌦️', 'Drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Drizzle'], 61: ['🌧️', 'Rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'], 71: ['🌨️', 'Snow'], 80: ['🌦️', 'Showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Storms'], 95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm'], 99: ['⛈️', 'Thunderstorm'] };
  let wxData = null;
  async function weather() {
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=29.4241&longitude=-98.4936&current=temperature_2m,weather_code,is_day,apparent_temperature,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago&forecast_days=4');
      wxData = await r.json();
      const c = wxData.current, d = wxData.daily;
      const [ic, cond] = WX[c.weather_code] || ['🌡️', 'Weather'];
      $$('[data-wx="icon"]').forEach(e => e.textContent = (!c.is_day && ic === '☀️') ? '🌙' : ic);
      $$('[data-wx="temp"]').forEach(e => e.textContent = Math.round(c.temperature_2m) + '°F');
      $$('[data-wx="cond"]').forEach(e => e.textContent = (!c.is_day && cond === 'Sunny') ? 'Clear' : cond);
      $$('[data-wx="hl"]').forEach(e => e.textContent = `H:${Math.round(d.temperature_2m_max[0])}° L:${Math.round(d.temperature_2m_min[0])}°`);
      $$('[data-wx="forecast"]').forEach(e => e.innerHTML = d.time.map((t, i) => `<div><b>${i ? new Date(t + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' }) : 'Today'}</b><span>${(WX[d.weather_code[i]] || ['🌡️'])[0]}</span><i>${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°</i></div>`).join(''));
    } catch { $$('[data-wx="cond"]').forEach(e => e.textContent = 'Offline'); }
  }
  weather(); setInterval(weather, 15 * 60 * 1000);

  /* ---------------- Drawer ---------------- */
  const panel = $('#panel'), backdrop = $('#backdrop'), body = $('#panelBody'), title = $('#panelTitle');
  let returnFocus = null;
  function openPanel(t, html, trigger) {
    returnFocus = trigger || document.activeElement;
    title.textContent = t; body.innerHTML = html;
    panel.hidden = false; backdrop.hidden = false;
    $('#panelClose').focus();
  }
  function closePanel() { panel.hidden = true; backdrop.hidden = true; if (returnFocus && returnFocus.focus) returnFocus.focus(); }
  $('#panelClose').addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) closePanel(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-go]')) { e.preventDefault(); go(e.target.dataset.go, e.target); } });

  function openApp(a) {
    if (!a) return;
    if (!a.url) {
      const link = (prompt(`Paste the link for your ${a.name} app (it's saved on this device):`, 'https://') || '').trim();
      if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(link)) { if (link && link !== 'https://') toast('That doesn\'t look like a web link'); return; }
      a.url = link; settings.appUrls = Object.assign({}, settings.appUrls, { [a.id]: link }); saveSettings();
      renderApps(); ping(a).then(st => { health[a.id] = st; renderApps(); });
      toast(`${a.name} linked`); return;
    }
    const w = window.open(a.url, a.local ? '_blank' : 'bb_' + a.id);
    if (!w) location.href = a.url;
  }
  const pill = id => { const s = health[id]; return `<span class="status-pill ${s || ''}">${s === 'on' ? 'Online' : s === 'off' ? 'Unreachable' : s === 'local' ? 'Laptop only' : 'Checking'}</span>`; };

  const VIEWS = {
    apps: () => ['All Apps', `<div class="big-apps">${APPS.map(a => tileHTML(a, true)).join('')}</div>
      <div class="card" style="margin-top:16px"><ul class="list">${APPS.map(a => `<li><span class="ic" style="--c:${a.color}"></span><div style="flex:1"><b>${esc(a.name)}</b><span>${esc(a.url.replace(/^https?:\/\//, ''))}</span></div>${pill(a.id)}</li>`).join('')}</ul>
      <p style="margin-top:10px">Last checked ${lastHealth ? ago(lastHealth.getTime()) : '—'}. Edit the roster in <code>cc/apps.js</code>.</p></div>`],
    alerts: () => ['Alerts', `<div class="card"><ul class="list">${allNotifs().slice(0, 40).map(n => { const k = KIND[n.kind] || KIND.system; return `<li><span class="ic" style="--c:${k.c}">${k.i}</span><div><b>${esc(n.title)}</b><span>${esc(n.body || '')}</span><i>${ago(n.time)}</i></div></li>`; }).join('') || '<li>No alerts yet.</li>'}</ul></div>
      ${settings.ntfy ? `<p class="muted" style="color:var(--muted)">Live feed: ntfy topic <b>${esc(settings.ntfy)}</b></p>` : `<div class="card"><h2>Connect your Chill Pros alerts</h2><p>Add your ntfy topic in Settings and new calls, approvals, tech readings and Autopilot activity land here live.</p><button class="btn" data-go="settings">Open Settings</button></div>`}`],
    settings: () => ['Settings', `
      <div class="card"><h2>Diamond shine</h2><p>How hard the ice hits.</p>
        <div class="seg" role="group" aria-label="Effect intensity">${['low', 'heavy', 'max'].map(v => `<button type="button" data-fx="${v}" aria-pressed="${settings.fx === v}">${v === 'low' ? 'Low' : v === 'heavy' ? 'Heavy' : 'Max Ice'}</button>`).join('')}</div></div>
      ${Object.keys(LOOKS).length > 1 ? `<div class="card"><h2>Avatar look</h2><div class="seg" role="group" aria-label="Avatar look">${Object.entries(LOOKS).map(([k, v]) => `<button type="button" data-look="${k}" aria-pressed="${settings.look === k}">${esc(v.label)}</button>`).join('')}</div></div>` : ''}
      <div class="card"><h2>Live alerts (ntfy)</h2><p>Your Chill Pros ntfy topic name (or full server URL). Notifications stream into the Command Center in real time.</p>
        <label class="fld" for="ntfyIn">Topic</label><input id="ntfyIn" class="txt" value="${esc(settings.ntfy)}" placeholder="e.g. chillpros-alerts" autocomplete="off">
        <button class="btn" type="button" data-save-ntfy>Save &amp; connect</button></div>
      <div class="card"><h2>Desktop mode</h2><p>Install this page as an app (browser menu → Install / “Add to Home Screen”), then set it to open at startup for an always-on desktop Command Center.</p></div>`],
    weather: () => {
      if (!wxData) return ['Weather', '<p>Loading…</p>'];
      const d = wxData.daily, c = wxData.current;
      return ['San Antonio Weather', `<div class="card"><h2>${Math.round(c.temperature_2m)}°F · ${(WX[c.weather_code] || ['', ''])[1]}</h2><p>Feels like ${Math.round(c.apparent_temperature)}° · Humidity ${c.relative_humidity_2m}% · Wind ${Math.round(c.wind_speed_10m)} mph</p></div>
        <div class="card"><ul class="list">${d.time.map((t, i) => `<li><span class="ic" style="--c:#0b2a3d">${(WX[d.weather_code[i]] || ['🌡️'])[0]}</span><div style="flex:1"><b>${new Date(t + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' })}</b><span>Rain chance ${d.precipitation_probability_max[i] ?? 0}%</span></div><b>${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°</b></li>`).join('')}</ul>
        <p style="color:var(--muted)">Heads-up for the crew: AC calls spike on hot days.</p></div>`];
    },
    money: () => {
      const today = new Date().toDateString();
      const list = notifs.filter(n => (n.kind === 'invoice' || n.kind === 'money') && MONEY_RE.test((n.title || '') + ' ' + (n.body || ''))).slice(0, 40);
      const sum = list.filter(n => new Date(n.time).toDateString() === today).reduce((t, n) => t + amountOf(n), 0);
      return ['Money', `<div class="card"><h2>Today: $${sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h2><p>Added up from dollar amounts in today's payment alerts.</p></div>
        <div class="card"><ul class="list">${list.map(n => `<li><span class="ic" style="--c:#15803d">💵</span><div><b>${esc(n.title)}</b><span>${esc(n.body || '')}</span><i>${ago(n.time)}</i></div></li>`).join('') || '<li>No money updates yet. Payments, deposits and paid invoices from your alerts show up here.</li>'}</ul></div>`];
    },
    status: () => ['System Status', `<div class="card"><ul class="list">${APPS.map(a => `<li><div style="flex:1"><b>${esc(a.name)}</b><span>${esc(a.url.replace(/^https?:\/\//, ''))}</span></div>${pill(a.id)}</li>`).join('')}</ul><button class="btn" type="button" data-recheck>Re-check now</button></div>`]
  };
  function routeView(key) {
    const r = ROUTES[key]; const a = appById(r.app);
    return [r.label, `<div class="card"><h2>${esc(r.label)}</h2><p>${esc(r.blurb)}</p><p style="margin-top:8px">Runs in <b>${esc(a.name)}</b> ${pill(a.id)}</p>
      <button class="btn" type="button" data-go="app:${a.id}">Open ${esc(r.label)} →</button></div>`];
  }

  function go(target, trigger, ev) {
    if (ev) burstAt(ev);
    if (target === 'home') { if (!panel.hidden) closePanel(); window.scrollTo({ top: 0, behavior: 'smooth' }); celebrate(); return; }
    if (target.startsWith('app:')) { openApp(appById(target.slice(4))); return; }
    if (ROUTES[target]) { const [t, h] = routeView(target); openPanel(t, h, trigger); return; }
    if (VIEWS[target]) { const [t, h] = VIEWS[target](); openPanel(t, h, trigger); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); go(b.dataset.go, b, e); return; }
    const fx = e.target.closest('[data-fx]'); if (fx && fx.tagName === 'BUTTON') { settings.fx = fx.dataset.fx; saveSettings(); $$('[data-fx]', body).forEach(x => x.setAttribute('aria-pressed', x === fx)); burstAt(e, 40); return; }
    const lk = e.target.closest('[data-look]'); if (lk) { settings.look = lk.dataset.look; saveSettings(); applyLook(); $$('[data-look]', body).forEach(x => x.setAttribute('aria-pressed', x === lk)); return; }
    if (e.target.closest('[data-save-ntfy]')) { settings.ntfy = $('#ntfyIn').value.trim(); saveSettings(); connectNtfy(); toast(settings.ntfy ? 'Alerts connected' : 'Alerts disconnected'); return; }
    if (e.target.closest('[data-recheck]')) { checkAll().then(() => { const [t, h] = VIEWS.status(); openPanel(t, h); }); }
  });

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200); }

  /* ---------------- Diamond FX engine ----------------
     Small, crisp sparkle pops placed only on diamond jewelry and the diamond chain borders
     (sparkles.json is a masked map of real diamond highlights in the art; text areas are excluded). */
  const FX = { low: { rate: 16, size: 1 }, heavy: { rate: 48, size: 1.35 }, max: { rate: 85, size: 1.6 } };
  let SP = { desktop: [], mobile: [], desktopJewel: 0 };
  fetch('cc/sparkles.json').then(r => r.json()).then(j => { SP = j; }).catch(() => {});

  const artSpan = l => l.kind === 'desktop' ? (parseFloat(getComputedStyle(l.art).getPropertyValue('--W')) || 1536) / 1536 : 1;
  const layers = $$('.art').map(art => ({ art, kind: art.classList.contains('art-d') ? 'desktop' : 'mobile', cv: $('canvas.fx', art), parts: [] }));
  // The wide-screen right column gets its own canvas so its diamond chains sparkle too.
  const side = $('.side');
  let sideLayer = null;
  if (side) { const cv = document.createElement('canvas'); cv.className = 'fx side-fx'; cv.setAttribute('aria-hidden', 'true'); side.appendChild(cv); sideLayer = { art: side, kind: 'side', cv, parts: [] }; }
  const allLayers = () => sideLayer ? layers.concat(sideLayer) : layers;
  function visibleLayer() { return layers.find(l => l.art.offsetParent !== null); }
  function sizeCanvas(l) {
    const r = l.art.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    l.w = r.width; l.h = r.height; l.cv.width = Math.round(r.width * dpr); l.cv.height = Math.round(r.height * dpr);
    l.ctx = l.cv.getContext('2d'); l.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(() => allLayers().forEach(sizeCanvas)); allLayers().forEach(l => ro.observe(l.art));

  function spawn(l, x, y, big) {
    const s = FX[settings.fx] || FX.heavy;
    const unit = Math.min(l.w || 1000, (l.h || 700) * 1.5) / 1100;          // scale with the art, not the window
    l.parts.push({ x, y, t: 0, life: 520 + Math.random() * 620, r: (big ? 4.2 : 2.2 + Math.random() * 2.2) * s.size * Math.max(.75, unit), rot: Math.random() * .5 - .25, ice: Math.random() < .3, hue: Math.random() < .35 ? [190, 210, 300, 45][Math.floor(Math.random() * 4)] : 0 });
  }
  // Intricate four-point star: hairline rays, a smaller diagonal set and a pinpoint core.
  function star(ctx, p, k) {
    const a = Math.sin(Math.PI * Math.min(1, k * 1.15)), r = p.r * (.35 + .75 * a);
    if (a <= .01) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, p.hue ? `hsla(${p.hue},100%,85%,.55)` : p.ice ? 'rgba(185,232,255,.5)' : 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const ang = i * Math.PI / 2; ctx.moveTo(Math.cos(ang - .5) * r * .18, Math.sin(ang - .5) * r * .18); ctx.lineTo(Math.cos(ang) * r * 4.6, Math.sin(ang) * r * 4.6); ctx.lineTo(Math.cos(ang + .5) * r * .18, Math.sin(ang + .5) * r * .18); }
    ctx.fill();
    ctx.globalAlpha = a * .7; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const ang = Math.PI / 4 + i * Math.PI / 2; ctx.moveTo(Math.cos(ang - .6) * r * .14, Math.sin(ang - .6) * r * .14); ctx.lineTo(Math.cos(ang) * r * 2.1, Math.sin(ang) * r * 2.1); ctx.lineTo(Math.cos(ang + .6) * r * .14, Math.sin(ang + .6) * r * .14); }
    ctx.fill();
    ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(0, 0, Math.max(.6, r * .32), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Random point on the side column's diamond chains (top, bottom, right edge, separators).
  function sidePoint(l) {
    const r = l.art.getBoundingClientRect(), u = innerHeight / 1024;
    const bands = [['h', 18 * u], ['h', r.height - 18 * u], ['v', r.width - 21 * u]];
    $$('.side-sep', l.art).forEach(sep => { const b = sep.getBoundingClientRect(); bands.push(['h', b.top - r.top + b.height / 2]); });
    const [kind, at] = bands[Math.floor(Math.random() * bands.length)];
    return kind === 'h' ? [16 * u + Math.random() * (r.width - 60 * u), at + (Math.random() - .5) * 8 * u] : [at + (Math.random() - .5) * 8 * u, 30 * u + Math.random() * (r.height - 60 * u)];
  }
  let last = performance.now(), acc = 0, accSide = 0;
  function frame(now) {
    const dt = Math.min(64, now - last); last = now;
    const l = visibleLayer();
    const s = FX[settings.fx] || FX.heavy;
    if (l && l.ctx && !document.hidden) {
      acc += dt * s.rate / 1000;
      const pts = SP[l.kind] || [];
      const span = artSpan(l), mapX = nx => nx / span;
      const jewel = l.kind === 'desktop' ? (SP.desktopJewel || 0) : 0;
      while (acc >= 1 && pts.length) {
        acc -= 1;
        // ~45% of pops land on the jewelry, the rest run along the diamond borders
        const fromJewel = jewel && jewel < pts.length && Math.random() < .45;
        const i = fromJewel ? jewel + Math.floor(Math.random() * (pts.length - jewel)) : Math.floor(Math.random() * (jewel || pts.length));
        const p = pts[i];
        if (p && p[0] <= span) spawn(l, mapX(p[0]) * l.w, p[1] * l.h);
      }
      acc = Math.min(acc, 3);
      if (cursor.in && Math.random() < s.rate / 90 && pts.length) { // a pop near the cursor, on a real diamond
        let best = null, bd = 1e9; for (let k = 0; k < 18; k++) { const p = pts[Math.floor(Math.random() * pts.length)]; if (p[0] > span) continue; const dx = mapX(p[0]) * l.w - cursor.x, dy = p[1] * l.h - cursor.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = p; } }
        if (best && bd < (l.w * .07) ** 2) spawn(l, mapX(best[0]) * l.w, best[1] * l.h, true);
      }
      const ctx = l.ctx; ctx.clearRect(0, 0, l.w, l.h); ctx.globalCompositeOperation = 'lighter';
      l.parts = l.parts.filter(p => (p.t += dt) < p.life);
      for (const p of l.parts) star(ctx, p, p.t / p.life);
    }
    if (sideLayer && sideLayer.ctx && sideLayer.art.offsetParent !== null && !document.hidden) {
      const sl = sideLayer;
      accSide += dt * s.rate * .45 / 1000;
      while (accSide >= 1) { accSide -= 1; const [x, y] = sidePoint(sl); spawn(sl, x, y); }
      const ctx = sl.ctx; ctx.clearRect(0, 0, sl.w, sl.h); ctx.globalCompositeOperation = 'lighter';
      sl.parts = sl.parts.filter(p => (p.t += dt) < p.life);
      for (const p of sl.parts) star(ctx, p, p.t / p.life);
    }
    requestAnimationFrame(frame);
  }
  if (!reduced || settings.fx !== 'low') requestAnimationFrame(frame);

  const cursor = { x: 0, y: 0, in: false };
  layers.forEach(l => {
    const move = (cx, cy) => { const r = l.art.getBoundingClientRect(); cursor.x = cx - r.left; cursor.y = cy - r.top; cursor.in = true; l.art.style.setProperty('--mx', (cursor.x / r.width * 100) + '%'); l.art.style.setProperty('--my', (cursor.y / r.height * 100) + '%'); };
    l.art.addEventListener('pointermove', e => move(e.clientX, e.clientY));
    l.art.addEventListener('pointerleave', () => { cursor.in = false; l.art.classList.remove('touching'); });
    l.art.addEventListener('pointerdown', e => { move(e.clientX, e.clientY); l.art.classList.add('touching'); });
    l.art.addEventListener('pointerup', () => setTimeout(() => l.art.classList.remove('touching'), 400));
  });
  // A tap gives a tiny burst on the nearest real diamonds, never a cloud over the words.
  function burstAt(ev, n) {
    const l = visibleLayer(); if (!l || !ev || ev.clientX == null) return;
    const r = l.art.getBoundingClientRect(); const x = ev.clientX - r.left, y = ev.clientY - r.top;
    const pts = SP[l.kind] || []; const span = artSpan(l);
    const near = pts.filter(p => p[0] <= span && Math.hypot(p[0] / span * r.width - x, p[1] * r.height - y) < r.width * .05);
    const count = Math.min(near.length, n || ({ low: 3, heavy: 6, max: 10 }[settings.fx] || 6));
    for (let i = 0; i < count; i++) { const p = near[Math.floor(Math.random() * near.length)]; spawn(l, p[0] / span * r.width, p[1] * r.height, i === 0); }
  }
  function celebrate() { document.body.classList.remove('pulse'); void document.body.offsetWidth; document.body.classList.add('pulse'); setTimeout(() => document.body.classList.remove('pulse'), 2800); }

  // phone tilt moves the shine like real jewelry
  addEventListener('deviceorientation', e => { if (e.gamma == null) return; document.documentElement.style.setProperty('--tilt', (e.gamma * 1.5).toFixed(1) + '%'); });

})();
