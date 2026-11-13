// Shared helpers for the owner console and customer portal.
window.VR = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tel = (p) => String(p || '').replace(/[^\d+]/g, '');
  const when = (d) => (d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
  const pill = (s) => `<span class="pill ${esc(s)}">${esc(s)}</span>`;
  let tt;
  const toast = (msg) => {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2200);
  };
  const SCORE = { A: 'HOT', B: 'WARM', C: 'COOL' };
  // Renders a lead card in the same layout as the PDF card.
  const card = (p, { kicker = 'Vehicle Radar · Lead card', open = false, footer = '' } = {}) => {
    const contact = (p.contact || []).map((c) => {
      const digits = tel(c.value);
      const isPhone = /phone|line/i.test(c.label) && digits.length >= 10;
      const val = isPhone ? `<a href="tel:${digits.slice(0, 11)}">${esc(c.value)}</a>` : esc(c.value);
      return `<dt>${esc(c.label)}</dt><dd>${val}</dd>`;
    }).join('');
    const list = (a) => `<ul>${(a || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return `<article class="lc">
      <div class="lc-head"><div><small>${esc(kicker)}</small><h3>${esc(p.name)}</h3><div class="need">Need: ${esc(p.need)} &nbsp;|&nbsp; Type: ${esc(p.type)}</div></div>
        <div class="score"><b>${esc(p.score)}</b><span>${SCORE[p.score] || ''}</span></div></div>
      <div class="lc-body">
        <h4>Contact</h4><dl class="kv">${contact}</dl>
        <details class="more" ${open ? 'open' : ''}><summary>Why they're a lead, pitch &amp; call script</summary>
          <h4>${p.score === 'A' ? "Why they're a hot lead" : "Why they're a good lead"}</h4>${list(p.why)}
          <h4>What to pitch</h4>${list(p.pitch)}
          <h4>Call script (30 seconds)</h4><div class="script">${esc(p.script)}</div>
          <h4>Deal value estimate</h4><p>${esc(p.value)}</p>
          <p class="meta">${esc(p.source_note)}</p>
        </details>
      </div>${footer ? `<div class="lc-foot">${footer}</div>` : ''}</article>`;
  };
  return { esc, tel, when, pill, toast, card };
})();
