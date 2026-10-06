/* eslint-disable @typescript-eslint/no-require-imports -- Varsity title wiring checks. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (f) => fs.readFileSync(f, 'utf8');

test('screen titles and section titles use varsity lettering', () => {
  assert.match(read('components/staff-shell-nav.tsx'), /<VarsityTitle text=\{screenTitle\} fuzz \/>/);
  assert.match(read('components/section-card.tsx'), /<VarsityTitle text=\{title\} \/>/);
});

test('letters cycle the wordmark colors and stay readable to screen readers', () => {
  const src = read('components/varsity-title.tsx');
  assert.match(src, /\["vl-red", "vl-blue", "vl-gold"\]/);
  assert.match(src, /className="sr-only">\{text\}</);
  assert.match(src, /aria-hidden="true"/);
  const css = read('styles/staff-theme.css');
  for (const c of ['.vl-red', '.vl-blue', '.vl-gold']) assert.ok(css.includes(`.varsity ${c}`), c);
});

test('header uses the CHILL PROS varsity wordmark and the font + fuzz filter are loaded', () => {
  assert.match(read('components/staff-shell-nav.tsx'), /chill-pros-varsity-900\.webp/);
  assert.ok(fs.existsSync('public/brand/chill-pros-varsity-900.webp'));
  const layout = read('app/layout.tsx');
  assert.match(layout, /Alfa_Slab_One\(/);
  assert.match(layout, /id="cb-chenille"/);
});
