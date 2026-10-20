const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'public/icons/spa');
const expected = [
  'sectionfirst-1.svg', 'sectionfirst-2.svg', 'sectionfirst-3.svg',
  'sectionsecond-1.svg', 'sectionsecond-2.svg', 'sectionsecond-3.svg', 'sectionsecond-4.svg',
  'sectionthird-1.svg', 'sectionthird-2.svg', 'sectionthird-3.svg',
  '3packet-1.svg', '3packet-2.svg', '3packet-3.svg'
];

test('all thirteen spa icons are transparent vectors with a common canvas and consistent weights within each set', () => {
  assert.deepEqual(fs.readdirSync(directory).sort(), [...expected].sort());
  for (const filename of expected) {
    const svg = fs.readFileSync(path.join(directory, filename), 'utf8');
    assert.match(svg, /^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, filename);
    assert.match(svg, /viewBox="0 0 128 128"/, filename);
    assert.match(svg, /width="128" height="128"/, filename);
    const weight = filename.startsWith('3packet-') ? 0.85 : 2;
    assert.ok(svg.includes(`fill="none" stroke="#F2630C" stroke-width="${weight}"`), filename);
    assert.match(svg, /stroke-linecap="round" stroke-linejoin="round"/, filename);
    assert.match(svg, /<path\s+d="[^"]+"/, filename);
    assert.doesNotMatch(svg, /<(?:image|rect|text|foreignObject|filter|linearGradient|radialGradient|script)\b|href=|data:|<!(?:DOCTYPE|ENTITY)/i, filename);
    for (const [, color] of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      assert.ok(['none', '#F2630C'].includes(color), `${filename}: unexpected color ${color}`);
    }
    const group = svg.match(/<g\b[^>]+>/)[0];
    const scale = Number(group.match(/scale\(([\d.]+)\)/)[1]);
    const lineWidth = Number(group.match(/stroke-width="([\d.]+)"/)[1]);
    assert.ok(Math.abs(scale * lineWidth - weight) < 0.0001, `${filename}: effective stroke must be ${weight}`);
  }
});

test('the three icon sets belong to their sections, with Telegram, support and clock in semantic order', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const sections = [
    ['feature-icon', ['sectionfirst-2.svg', 'sectionfirst-1.svg', 'sectionfirst-3.svg']],
    ['self-love-icon', expected.slice(3, 7)],
    ['result-icon', ['sectionthird-2.svg', 'sectionthird-3.svg', 'sectionthird-1.svg']],
    ['package-icon', ['3packet-3.svg', '3packet-2.svg', '3packet-1.svg']]
  ];
  for (const [className, filenames] of sections) {
    const images = [...html.matchAll(new RegExp(`<img class="${className} spa-icon"[^>]+>`, 'g'))].map(match => match[0]);
    assert.equal(images.length, filenames.length, className);
    images.forEach((image, index) => {
      const source = new URL(image.match(/\bsrc="([^"]+)"/)[1], 'http://localhost');
      assert.equal(source.pathname, `/icons/spa/${filenames[index]}`);
      assert.ok(image.includes('width="128" height="128"'));
      assert.ok(image.includes('alt="" aria-hidden="true"'));
    });
  }
  assert.doesNotMatch(html, /class="(?:icon-placeholder|result-icon-placeholder|package-icon-placeholder)"/);
});

test('package illustrations stay paired with their requested prices', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const packages = [
    ['independent', '3packet-3.svg', '40'],
    ['group', '3packet-2.svg', '200'],
    ['advanced', '3packet-1.svg', '400']
  ];
  for (const [name, icon, price] of packages) {
    const card = html.match(new RegExp(`<article[^>]+aria-labelledby="package-${name}-title"[\\s\\S]*?</article>`))[0];
    const source = new URL(card.match(/class="package-icon spa-icon" src="([^"]+)"/)[1], 'http://localhost');
    assert.equal(source.pathname, `/icons/spa/${icon}`);
    assert.match(card, new RegExp(`<p class="package-price">${price} `));
  }
});
