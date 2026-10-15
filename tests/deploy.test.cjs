const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Vercel separates the public output and API, without a catch-all HTML rewrite', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'public');
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.installCommand, 'npm ci');
  assert.equal(config.functions['api/apply.js'].maxDuration, 15);
  assert.equal(config.builds, undefined);
  assert.equal(config.rewrites, undefined);
  const headers = config.headers.find(rule => rule.source === '/(.*)').headers;
  assert.ok(headers.some(header => header.key === 'X-Content-Type-Options' && header.value === 'nosniff'));
  assert.ok(config.redirects.some(rule => rule.source === '/index.html' && rule.destination === '/' && rule.permanent));
});

test('deployment upload allowlist and Git exclusions keep local files out', () => {
  const allowed = read('.vercelignore').split(/\r?\n/).filter(line => line.startsWith('!')).map(line => line.slice(2));
  assert.equal(read('.vercelignore').split(/\r?\n/).find(line => line && !line.startsWith('#')), '/*');
  for (const required of ['public', 'api', 'lib', 'scripts', 'package.json', 'package-lock.json', 'vercel.json']) assert.ok(allowed.includes(required));
  for (const excluded of ['.env', '.env.local', '.vercel', '.git', 'qa', 'node_modules', 'design-qa.md']) assert.ok(!allowed.includes(excluded));
  const gitignore = read('.gitignore');
  assert.ok(gitignore.includes('.env*'));
  assert.ok(gitignore.includes('!.env.example'));
  assert.ok(gitignore.includes('.vercel/'));
  assert.ok(gitignore.includes('.codex-*'));
});

test('domain is consistent, and there are no restored legal pages', () => {
  for (const file of ['public/index.html', 'public/robots.txt', 'public/sitemap.xml']) assert.ok(read(file).includes('https://olgraprem.org.ua/'));
  assert.ok(!read('public/index.html').includes('legal.html'));
  assert.equal(fs.existsSync(path.join(root, 'public/legal.html')), false);
  const site = read('public/index.html');
  assert.ok(site.includes('name="website"'));
  assert.ok(site.includes('hidden aria-hidden="true"'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages[''].engines.node, '24.x');
});

test('production build fails closed without Telegram credentials; valid-format settings do not make network calls', () => {
  const env = { ...process.env, VERCEL_ENV: 'production', TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' };
  let result = spawnSync(process.execPath, ['scripts/check-deploy.js'], { cwd: root, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TELEGRAM_BOT_TOKEN/);
  const fakeToken = `123456:${'T'.repeat(35)}`;
  env.TELEGRAM_BOT_TOKEN = fakeToken;
  env.TELEGRAM_CHAT_ID = '-100123456789';
  result = spawnSync(process.execPath, ['scripts/check-deploy.js'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes(fakeToken));
  assert.ok(!result.stderr.includes(fakeToken));
});
