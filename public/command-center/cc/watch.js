/* Big Booda live watch: an original two-tone, diamond-bezel face drawn in SVG.
   Hands follow the real time (smooth sweeping seconds); diamonds along the bezel twinkle. */
(() => {
  'use strict';
  const svg = document.querySelector('svg.watch');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rad = d => (d - 90) * Math.PI / 180;
  const pt = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];

  // Bezel diamonds: 44 stones on a gold ring.
  const STONES = 44;
  let stones = '';
  for (let i = 0; i < STONES; i++) {
    const [x, y] = pt(88, i * 360 / STONES);
    stones += `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><circle r="5.6" fill="url(#wSet)"/><circle r="4.4" fill="url(#wStone)"/><path d="M-2.6 -1.2L0 -3.6L2.6 -1.2L0 3.4Z" fill="#fff" opacity=".55"/></g>`;
  }

  // Twinkle stars that sit on bezel stones (re-positioned at random as they fade).
  let stars = '';
  for (let i = 0; i < 9; i++) stars += `<g class="w-star" style="--d:${(i * 0.37).toFixed(2)}s"><path d="M0 -9L1.4 -1.4L9 0L1.4 1.4L0 9L-1.4 1.4L-9 0L-1.4 -1.4Z" fill="#fff"/><circle r="2.4" fill="#fff"/></g>`;

  // Hour markers: diamonds in round gold settings (none at 3, where the date sits).
  let marks = '';
  for (let h = 1; h <= 12; h++) {
    if (h === 3) continue;
    const [x, y] = pt(h === 12 ? 58 : 60, h * 30);
    const r = h === 12 ? 6.4 : 5.4;
    marks += `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><circle r="${r + 1.8}" fill="url(#wGold)" stroke="#8a6a1f" stroke-width=".6"/><circle r="${r}" fill="url(#wStone)"/><path d="M${-r * .5} ${-r * .2}L0 ${-r * .7}L${r * .5} ${-r * .2}L0 ${r * .6}Z" fill="#fff" opacity=".6"/></g>`;
  }
  // Minute track.
  let track = '';
  for (let m = 0; m < 60; m++) {
    if (m % 5 === 0) continue;
    const [x1, y1] = pt(71, m * 6), [x2, y2] = pt(68.5, m * 6);
    track += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
  }
  // Dial texture: fine concentric rings + soft sunburst (original guilloche).
  let rings = '';
  for (let r = 6; r < 72; r += 3) rings += `<circle r="${r}"/>`;
  let rays = '';
  for (let a = 0; a < 360; a += 6) { const [x, y] = pt(74, a); rays += `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }

  svg.innerHTML = `
  <defs>
    <linearGradient id="wGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3c2"/><stop offset=".35" stop-color="#e7c25a"/><stop offset=".6" stop-color="#b8892a"/><stop offset="1" stop-color="#f6dd8a"/></linearGradient>
    <radialGradient id="wSet" cx=".4" cy=".35"><stop offset="0" stop-color="#fff7d6"/><stop offset="1" stop-color="#a87b22"/></radialGradient>
    <radialGradient id="wStone" cx=".35" cy=".3"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e8f6ff"/><stop offset=".8" stop-color="#9cc8e6"/><stop offset="1" stop-color="#cfe9ff"/></radialGradient>
    <radialGradient id="wDial" cx=".45" cy=".4"><stop offset="0" stop-color="#fbf6ea"/><stop offset=".7" stop-color="#e9dfc8"/><stop offset="1" stop-color="#cfc2a3"/></radialGradient>
    <linearGradient id="wSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#9aa3ad"/><stop offset="1" stop-color="#e3e7eb"/></linearGradient>
    <linearGradient id="wHand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8892a"/><stop offset=".5" stop-color="#fff0b8"/><stop offset="1" stop-color="#b8892a"/></linearGradient>
    <filter id="wShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.2" flood-color="#000" flood-opacity=".45"/></filter>
    <radialGradient id="wGlass" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="94" y="-9" width="9" height="18" rx="2.5" fill="url(#wGold)" stroke="#8a6a1f" stroke-width=".6"/>
  <circle r="99" fill="url(#wGold)" stroke="#7a5a16" stroke-width="1"/>
  <circle r="95.5" fill="#2a1d05" opacity=".35"/>
  <circle r="95" fill="url(#wGold)"/>
  <g class="w-stones">${stones}</g>
  <circle r="79.5" fill="url(#wSteel)"/>
  <circle r="76" fill="url(#wDial)"/>
  <g stroke="#b9a77d" stroke-width=".35" fill="none" opacity=".55">${rings}</g>
  <g stroke="#fff" stroke-width=".5" opacity=".25">${rays}</g>
  <g stroke="#7d6a43" stroke-width=".9" stroke-linecap="round">${track}</g>
  <g>${marks}</g>
  <text y="-30" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="9.5" font-weight="700" letter-spacing="1.6" fill="#3b2d10">BIG BOODA</text>
  <text y="-20.5" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="5.2" letter-spacing="2" fill="#7a6534">COMMAND</text>
  <text y="36" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="5.6" font-weight="700" letter-spacing="2.4" fill="#3b2d10">CHILL PROS</text>
  <g transform="translate(52 0)"><rect x="-10" y="-7.5" width="20" height="15" rx="1.5" fill="url(#wGold)"/><rect x="-8.6" y="-6.2" width="17.2" height="12.4" rx="1" fill="#fff"/><text class="w-date" y="4.2" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="800" fill="#111">--</text></g>
  <g filter="url(#wShadow)">
    <g class="w-hour"><path d="M-3.6 10 L-3.2 -34 L0 -40 L3.2 -34 L3.6 10 Z" fill="url(#wHand)" stroke="#7a5a16" stroke-width=".5"/><rect x="-1.4" y="-32" width="2.8" height="24" rx="1.2" fill="#f8fbff"/></g>
    <g class="w-min"><path d="M-2.8 12 L-2.4 -56 L0 -63 L2.4 -56 L2.8 12 Z" fill="url(#wHand)" stroke="#7a5a16" stroke-width=".5"/><rect x="-1.1" y="-54" width="2.2" height="40" rx="1" fill="#f8fbff"/></g>
    <g class="w-sec"><line y1="18" y2="-66" stroke="#c9a23a" stroke-width="1.3" stroke-linecap="round"/><circle cy="-50" r="2.6" fill="#c9a23a"/><circle cy="-50" r="1.4" fill="#f8fbff"/></g>
    <circle r="4.6" fill="url(#wGold)" stroke="#7a5a16" stroke-width=".5"/>
  </g>
  <circle r="76" fill="url(#wGlass)" pointer-events="none"/>
  <g class="w-stars">${stars}</g>`;

  const hour = svg.querySelector('.w-hour'), min = svg.querySelector('.w-min'), sec = svg.querySelector('.w-sec'), date = svg.querySelector('.w-date');
  function draw() {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000, m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
    hour.setAttribute('transform', `rotate(${(h * 30).toFixed(3)})`);
    min.setAttribute('transform', `rotate(${(m * 6).toFixed(3)})`);
    sec.setAttribute('transform', `rotate(${((reduced ? Math.floor(s) : s) * 6).toFixed(3)})`);
    const d = String(now.getDate());
    if (date.textContent !== d) date.textContent = d;
  }
  draw();
  if (reduced) setInterval(draw, 1000);
  else (function loop() { draw(); requestAnimationFrame(loop); })();

  // Bezel sparkle: each star hops to a random stone every time its twinkle cycle restarts.
  const place = star => { const [x, y] = pt(88, Math.floor(Math.random() * STONES) * 360 / STONES); star.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${Math.floor(Math.random() * 45)})`); };
  svg.querySelectorAll('.w-star').forEach(star => { place(star); star.addEventListener('animationiteration', () => place(star)); });
})();
