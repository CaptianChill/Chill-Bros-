/* Brae.I. in the cloud: a Command Center tab with Brae's own AI.
   Chat  — Claude (OpenAI backup), with his saved profile; speak or type, replies can be read aloud.
   Create — OpenAI images: describe it, or upload a picture to edit; download or keep editing the result.
   Profile — how Brae.I. should know and treat him; saved to his HQ board (or this device outside HQ).
   Keys live on the server (/api/hq/brai); owner sign-in only. */
(() => {
  'use strict';
  const HQ = window.BB_HQ || null;
  const API = HQ ? 'https://chill-bros.vercel.app/api/hq/brai' : '/api/hq/brai';
  const SB = 'https://rbhtdgqpktocavxbiafw.supabase.co';
  const KEY = 'sb_publishable_QmdOKzwUgIFM8MfZWdpeBw_8CefyFOz';
  const LOCAL = 'brai-profile';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const history = [];
  let profile = '', source = null, busy = false, voiceOn = true, rec = null;
  try { voiceOn = localStorage.getItem('brai-voice') !== 'off'; } catch {}

  /* ---------- server ---------- */
  async function call(body) {
    const r = await fetch(API, {
      method: 'POST', cache: 'no-store', credentials: HQ ? 'omit' : 'same-origin',
      headers: Object.assign({ 'Content-Type': 'application/json' }, HQ ? { 'x-hq-token': HQ.token } : {}),
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => null);
    if (r.status === 401) { if (HQ) HQ.signIn(); throw new Error('Sign in first (Owner access).'); }
    if (!j || !j.ok) throw new Error((j && j.error) || 'No answer. Try again.');
    return j;
  }
  async function rpc(fn, args) {
    const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error('network');
    return r.json();
  }
  async function loadProfile() {
    try { profile = localStorage.getItem(LOCAL) || ''; } catch {}
    if (!HQ) return;
    try {
      const d = await rpc('hq_pull', { p_token: HQ.token });
      const item = (d.items || []).find(i => i.id === 'brai-profile');
      if (item && item.data && typeof item.data.text === 'string') profile = item.data.text;
    } catch {}
  }
  async function saveProfile(text) {
    profile = text;
    try { localStorage.setItem(LOCAL, text); } catch {}
    if (HQ) await rpc('hq_put', { p_token: HQ.token, p_id: 'brai-profile', p_board: 'brae', p_kind: 'info', p_data: { title: 'Brae.I. profile', text } });
  }

  /* ---------- voice ---------- */
  function speak(text) {
    if (!voiceOn || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`>]/g, '').slice(0, 1200));
    const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    const v = [/serena/i, /kate/i, /martha/i, /libby/i, /sonia/i, /google uk english female/i, /female/i].map(p => vs.find(x => p.test(x.name))).find(Boolean)
      || vs.find(x => x.lang === 'en-GB') || vs[0];
    if (v) u.voice = v;
    u.rate = 1.03;
    speechSynthesis.speak(u);
  }

  /* ---------- UI ---------- */
  const css = document.createElement('style');
  css.textContent = `
.brai .brai-tabs{display:flex;gap:8px;margin-bottom:14px}
.brai .brai-tabs button{flex:1;padding:10px 0;border-radius:999px;border:2px solid rgba(223,233,242,.5);background:#03070b;color:#cfe;font:800 13px/1 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.brai .brai-tabs button[aria-selected="true"]{border-color:#fff;color:#fff;box-shadow:0 0 14px rgba(31,182,255,.55);background:linear-gradient(180deg,#0e2232,#050b11)}
.brai .brai-log{display:grid;gap:10px;max-height:52vh;overflow:auto;padding:4px 2px}
.brai .msg{margin:0;padding:10px 13px;border-radius:16px;line-height:1.45;white-space:pre-wrap;max-width:88%;font-size:15px}
.brai .msg.me{justify-self:end;background:linear-gradient(180deg,#1fb6ff,#0b86c4);color:#021018}
.brai .msg.ai{justify-self:start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.brai form{display:flex;gap:8px;margin-top:12px}
.brai input[type=text],.brai textarea,.brai select{flex:1;min-width:0;padding:11px 12px;font:16px Inter,sans-serif}
.brai textarea{width:100%;box-sizing:border-box;min-height:110px;resize:vertical}
.brai .brai-img{width:100%;border-radius:14px;margin-top:12px;box-shadow:0 0 22px rgba(255,255,255,.12)}
.brai .brai-src{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:13px;color:#9cc}
.brai .brai-src img{width:56px;height:56px;object-fit:cover;border-radius:10px;border:2px solid #dfe9f2}
.brai .brai-note{font-size:13px;color:#8fb4c8;margin:8px 0 0}
.brai .brai-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.brai [hidden]{display:none!important}
.panel.brai{z-index:46}.panel-bg.brai-bg{z-index:45}`;
  document.head.appendChild(css);

  const bg = document.createElement('div'); bg.className = 'panel-bg brai-bg'; bg.hidden = true;
  const box = document.createElement('aside');
  box.className = 'panel brai'; box.hidden = true;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Brae.I.');
  box.innerHTML = `<header><button type="button" class="brai-x" aria-label="Close">×</button><h1>Brae.I.</h1></header>
  <div class="panel-body">
    <div class="brai-tabs" role="tablist">
      <button type="button" role="tab" data-tab="chat" aria-selected="true">Chat</button>
      <button type="button" role="tab" data-tab="create" aria-selected="false">Create</button>
      <button type="button" role="tab" data-tab="profile" aria-selected="false">Profile</button>
    </div>
    <section class="card" data-pane="chat">
      <h2>Talk to Brae.I.</h2>
      <div class="brai-log" aria-live="polite"><p class="msg ai">What we building today, Boss? Ask me anything — money, plans, prompts, code ideas.</p></div>
      <form class="brai-chat"><button type="button" class="btn brai-mic" aria-label="Talk">🎤</button><input type="text" name="m" autocomplete="off" placeholder="Ask Brae.I.…" aria-label="Message Brae.I."><button class="btn" aria-label="Send">Send</button></form>
      <div class="brai-row"><button type="button" class="btn ghost brai-voice"></button><button type="button" class="btn ghost brai-clear">New chat</button></div>
    </section>
    <section class="card" data-pane="create" hidden>
      <h2>Create</h2>
      <textarea class="brai-prompt" placeholder="Describe it: airbrush blue-flame Chill Pros logo on a black tee, smoky graffiti background…" aria-label="Image description"></textarea>
      <div class="brai-row" style="margin-top:10px">
        <select class="brai-size" aria-label="Shape"><option value="1024x1024">Square</option><option value="1024x1536">Tall (phone)</option><option value="1536x1024">Wide (desktop)</option></select>
        <label class="btn ghost" style="margin-top:0">📎 Picture to edit<input type="file" accept="image/*" class="brai-file" hidden></label>
      </div>
      <div class="brai-src" hidden><img alt="Picture being edited"><span>Editing this picture</span><button type="button" class="btn ghost brai-unsrc" style="margin-top:0">Remove</button></div>
      <button type="button" class="btn brai-make">Make it</button>
      <p class="brai-note">Runs on your OpenAI key (Studio, filtered). Your prompt and picture go to OpenAI to make it; nothing is saved here until you download.</p>
      <div class="brai-out"></div>
    </section>
    <section class="card" data-pane="profile" hidden>
      <h2>Your profile</h2>
      <p>Tell Brae.I. who you are and how to talk to you. It reads this before every answer.</p>
      <textarea class="brai-prof" style="margin-top:10px;min-height:200px" placeholder="Name, businesses, goals, how you like answers (short, straight to the point), voice, style…"></textarea>
      <button type="button" class="btn brai-save">Save profile</button>
      <p class="brai-note">${HQ ? 'Saved to your HQ board, so it follows you to every device.' : 'Saved on this device. Open the Command Center inside HQ to sync it everywhere.'}</p>
    </section>
  </div>`;
  document.body.append(bg, box);

  const $ = s => box.querySelector(s);
  const log = $('.brai-log');
  const toast = m => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200); };
  const setVoiceLabel = () => { $('.brai-voice').textContent = voiceOn ? '🔊 Voice on' : '🔈 Voice off'; };
  setVoiceLabel();

  let returnFocus = null;
  function open(trigger) {
    returnFocus = trigger || document.activeElement;
    box.hidden = false; bg.hidden = false;
    $('.brai-prof').value = profile;
    $('.brai-chat input').focus();
  }
  function close() { box.hidden = true; bg.hidden = true; speechSynthesis && speechSynthesis.cancel(); if (returnFocus && returnFocus.focus) returnFocus.focus(); }
  $('.brai-x').addEventListener('click', close); bg.addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });

  box.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    box.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    box.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tab; });
  }));

  /* chat */
  function add(role, text) { const p = document.createElement('p'); p.className = 'msg ' + (role === 'user' ? 'me' : 'ai'); p.textContent = text; log.appendChild(p); log.scrollTop = log.scrollHeight; return p; }
  async function send(text) {
    const m = text.trim(); if (!m || busy) return;
    busy = true; add('user', m); history.push({ role: 'user', content: m });
    const wait = add('assistant', 'Thinking…');
    try {
      const j = await call({ action: 'chat', messages: history.slice(-16), profile });
      wait.textContent = j.text; history.push({ role: 'assistant', content: j.text }); speak(j.text);
    } catch (e) { wait.textContent = e.message; history.pop(); }
    finally { busy = false; }
  }
  $('.brai-chat').addEventListener('submit', e => { e.preventDefault(); const i = $('.brai-chat input'); const v = i.value; i.value = ''; send(v); });
  $('.brai-voice').addEventListener('click', () => { voiceOn = !voiceOn; if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel(); try { localStorage.setItem('brai-voice', voiceOn ? 'on' : 'off'); } catch {} setVoiceLabel(); });
  $('.brai-clear').addEventListener('click', () => { history.length = 0; log.innerHTML = '<p class="msg ai">Fresh start. What we doing?</p>'; });
  $('.brai-mic').addEventListener('click', () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { toast('This browser can\'t listen. Use the keyboard mic.'); return; }
    if (rec) { rec.stop(); return; }
    rec = new R(); rec.lang = 'en-US'; rec.interimResults = false;
    $('.brai-mic').textContent = '■';
    rec.onresult = ev => { const t = ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : ''; if (t) send(t); };
    rec.onend = () => { rec = null; $('.brai-mic').textContent = '🎤'; };
    rec.start();
  });

  /* create */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 1536 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/png').length < 3.8e6 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .9));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file isn\'t a picture.')); };
      img.src = url;
    });
  }
  function showSource() { const s = $('.brai-src'); s.hidden = !source; if (source) s.querySelector('img').src = source; }
  $('.brai-file').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; try { source = await shrink(f); showSource(); } catch (err) { toast(err.message); } });
  $('.brai-unsrc').addEventListener('click', () => { source = null; showSource(); });
  $('.brai-make').addEventListener('click', async () => {
    const prompt = $('.brai-prompt').value.trim(); if (!prompt) { toast('Describe what to make first.'); return; }
    const btn = $('.brai-make'); if (btn.disabled) return;
    btn.disabled = true; btn.textContent = source ? 'Editing…' : 'Making…';
    try {
      const j = await call({ action: 'image', prompt, image: source, size: $('.brai-size').value });
      const out = $('.brai-out');
      out.innerHTML = `<img class="brai-img" alt="${esc(prompt)}" src="${esc(j.image)}"><div class="brai-row"><a class="btn" download="brae-i.png" href="${esc(j.image)}">Download</a><button type="button" class="btn ghost brai-again">Edit this one</button></div>`;
      out.querySelector('.brai-again').addEventListener('click', () => { source = j.image; showSource(); $('.brai-prompt').value = ''; $('.brai-prompt').focus(); });
    } catch (e) { toast(e.message); }
    finally { btn.disabled = false; btn.textContent = 'Make it'; }
  });

  /* profile */
  $('.brai-save').addEventListener('click', async () => {
    const b = $('.brai-save'); b.disabled = true;
    try { await saveProfile($('.brai-prof').value.trim()); toast('Profile saved'); } catch { toast('Saved on this device; HQ sync failed'); }
    finally { b.disabled = false; }
  });

  /* dock button next to Talk / HQ / Claude */
  function mountButton() {
    const dock = document.querySelector('.talk-dock');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'talk-btn talk-brai'; btn.setAttribute('aria-label', 'Open Brae.I.');
    btn.innerHTML = '<span class="talk-ico" aria-hidden="true">💎</span><span class="talk-lbl">Brae.I.</span>';
    btn.addEventListener('click', () => open(btn));
    (dock || document.body).appendChild(btn);
    // On phones the buttons join the page (top of My Apps) instead of floating over the cards.
    const place = () => {
      const d = document.querySelector('.talk-dock'), apps = document.querySelector('.dock-m'), title = apps && apps.querySelector('.dock-title');
      if (!d || !apps) return;
      const phone = getComputedStyle(apps).display !== 'none';
      if (phone && !d.classList.contains('in-flow')) { d.classList.add('in-flow'); (title || apps.firstChild).after(d); }
      else if (!phone && d.classList.contains('in-flow')) { d.classList.remove('in-flow'); document.body.appendChild(d); }
    };
    place(); addEventListener('resize', place);
  }
  mountButton();
  loadProfile();
  window.BB_BRAI = { open };
})();
