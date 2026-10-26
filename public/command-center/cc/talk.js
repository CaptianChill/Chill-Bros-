/* Talk to Chilly Bro from the Command Center.
   🎤 Talk: speak (or type); the same assistant HQ uses answers out loud with this device's free built-in voice.
   "Change the BBB app so…" comes back as a card; tap Queue it and the hourly build runner builds, tests and ships it.
   Quotes, invoices and payment reminders are finished in HQ (nothing is created or sent from speech alone).
   ✦ Claude: opens a live Claude session for back-and-forth work, same as the phone workflow. */
(() => {
  'use strict';
  const HQ = window.BB_HQ || null;
  const HQ_URL = 'https://chill-pros-hq.vercel.app/brae';
  const CLAUDE_URL = 'https://claude.ai/code';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const history = [];
  let busy = false, rec = null, listening = false;

  /* ---------- UI ---------- */
  const dock = document.createElement('div');
  dock.className = 'talk-dock';
  dock.innerHTML = `<button type="button" class="talk-btn talk-mic" aria-label="Talk to Chilly Bro"><span class="talk-ico" aria-hidden="true">🎤</span><span class="talk-lbl">Talk</span></button>
    <a class="talk-btn talk-claude" href="${CLAUDE_URL}" target="_blank" rel="noopener" aria-label="Open a live Claude session"><span class="talk-ico" aria-hidden="true">✦</span><span class="talk-lbl">Claude</span></a>`;
  document.body.appendChild(dock);

  const sheet = document.createElement('section');
  sheet.className = 'talk-sheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Talk to Chilly Bro');
  sheet.innerHTML = `<header><b>Chilly Bro</b><span class="talk-state" aria-live="polite">Tap the mic and talk</span><button type="button" class="talk-x" aria-label="Close">×</button></header>
    <div class="talk-log" aria-live="polite"></div>
    <form class="talk-form"><button type="button" class="talk-rec" aria-label="Hold to talk">🎤</button><input name="m" autocomplete="off" placeholder="Or type: what's unpaid? / change the BBB app so…"><button class="talk-send" aria-label="Send">➤</button></form>`;
  document.body.appendChild(sheet);
  const log = sheet.querySelector('.talk-log'), state = sheet.querySelector('.talk-state'), input = sheet.querySelector('input');

  const open = () => { sheet.hidden = false; dock.classList.add('on'); if (!log.children.length) add('bot', "Hey Booda. Ask me about money, jobs or unpaid invoices, or tell me what to change in any of your apps."); };
  const close = () => { sheet.hidden = true; dock.classList.remove('on'); stopListening(); try { speechSynthesis.cancel(); } catch {} };
  dock.querySelector('.talk-mic').addEventListener('click', () => { if (sheet.hidden) { open(); startListening(); } else startListening(); });
  sheet.querySelector('.talk-x').addEventListener('click', close);
  sheet.querySelector('.talk-rec').addEventListener('click', () => (listening ? stopListening() : startListening()));
  sheet.querySelector('.talk-form').addEventListener('submit', e => { e.preventDefault(); const m = input.value.trim(); if (m) { input.value = ''; send(m); } });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) close(); });

  function add(who, text, extra) {
    const row = document.createElement('div');
    row.className = 'talk-msg ' + who;
    row.innerHTML = `<p>${esc(text)}</p>${extra || ''}`;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  /* ---------- voice out: free built-in voice ---------- */
  function pickVoice() {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const en = vs.filter(v => /^en(-|_)US/i.test(v.lang));
    return en.find(v => /(aaron|alex|daniel|fred|guy|davis|male|google us english)/i.test(v.name)) || en[0] || vs[0] || null;
  }
  function speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).slice(0, 600));
      const v = pickVoice(); if (v) u.voice = v;
      u.rate = 1.05; u.pitch = 0.9;
      speechSynthesis.speak(u);
    } catch {}
  }

  /* ---------- voice in: the browser's speech-to-text ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function startListening() {
    if (busy) return;
    if (!SR) { state.textContent = 'Voice typing not supported here: type below, or use your keyboard mic.'; input.focus(); return; }
    try { speechSynthesis.cancel(); } catch {}
    stopListening();
    rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    let finalText = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t; else interim += t; }
      input.value = (finalText + interim).trim();
    };
    rec.onerror = e => { state.textContent = e.error === 'not-allowed' ? 'Allow the microphone for this page, then try again.' : 'Didn’t catch that. Tap the mic again.'; };
    rec.onend = () => { listening = false; sheet.classList.remove('rec'); const m = (finalText || input.value).trim(); if (m) { input.value = ''; send(m); } else if (!busy) state.textContent = 'Tap the mic and talk'; };
    try { rec.start(); listening = true; sheet.classList.add('rec'); state.textContent = 'Listening…'; } catch { state.textContent = 'Tap the mic again.'; }
  }
  function stopListening() { if (rec) { try { rec.stop(); } catch {} } }

  /* ---------- server ---------- */
  async function call(body) {
    const r = await fetch(HQ ? '/cc-talk' : '/api/command-center/talk', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'manual',
      headers: Object.assign({ 'Content-Type': 'application/json' }, HQ ? { 'x-hq-token': HQ.token } : {}),
      body: JSON.stringify(body)
    });
    if (r.status === 401 || r.type === 'opaqueredirect') { if (HQ) HQ.signIn(); throw new Error('Sign in first (Owner access).'); }
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('No answer. Try again.');
    return j;
  }

  async function send(message) {
    if (busy) return;
    busy = true; add('me', message); state.textContent = 'Thinking…';
    const wait = add('bot', '…'); wait.classList.add('wait');
    try {
      const j = await call({ action: 'ask', message, history: history.slice(-8) });
      wait.remove();
      if (!j.ok) throw new Error(j.error || 'Something went wrong.');
      const reply = j.reply || 'Done.';
      history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
      const card = j.card || null;
      let extra = '';
      if (card && card.type === 'change') extra = `<div class="talk-card"><span>App change</span><p>${esc(card.request)}</p><button type="button" class="talk-go" data-req="${esc(card.request)}">Queue it</button></div>`;
      else if (card && (card.type === 'draft' || card.type === 'reminder')) extra = `<div class="talk-card"><span>${card.type === 'draft' ? 'Quote / invoice' : 'Payment reminder'}</span><p>Finish and send this in HQ → Chill Pros tab.</p><a class="talk-go" href="${HQ_URL}">Open HQ</a></div>`;
      add('bot', reply, extra);
      speak(reply);
      state.textContent = 'Tap the mic to keep going';
    } catch (err) {
      wait.remove(); add('bot', err.message || 'Something went wrong.'); state.textContent = 'Tap the mic and try again';
    } finally { busy = false; }
  }

  log.addEventListener('click', async e => {
    const b = e.target.closest('button.talk-go'); if (!b || b.disabled) return;
    b.disabled = true; b.textContent = 'Queuing…';
    try {
      const j = await call({ action: 'change', request: b.dataset.req });
      if (!j.ok) throw new Error(j.error || 'Couldn’t queue it.');
      b.textContent = 'Queued ✓';
      const msg = j.message || 'Queued. You’ll get a phone alert when it ships.';
      add('bot', msg); speak(msg);
    } catch (err) { b.disabled = false; b.textContent = 'Queue it'; add('bot', err.message); }
  });

  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch {} }
})();
