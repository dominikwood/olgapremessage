const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createLeadHandler } = require('../lib/lead-handler.js');

const env = { TELEGRAM_BOT_TOKEN: '123456:TEST_ONLY_NOT_A_REAL_TOKEN', TELEGRAM_CHAT_ID: '42' };
const lead = { name: 'Test', telegram: '@test_user', phone: '+380 67 123 45 67', message: 'Comment', language: 'uk', source: 'Package 40 EUR', website: '' };

async function invoke({ payload = lead, raw, parsed = false, bodyGetterError = false, headers = {}, method = 'POST', config = env, fetchImpl } = {}) {
  const calls = [];
  const reports = [];
  const chunks = raw === undefined ? [JSON.stringify(payload)] : Array.isArray(raw) ? raw : [raw];
  const request = Readable.from(chunks.map(value => Buffer.from(value)));
  request.method = method;
  request.headers = { host: 'olgraprem.org.ua', 'content-type': 'application/json', ...headers };
  if (parsed) request.body = payload;
  if (bodyGetterError) Object.defineProperty(request, 'body', { get() { throw new SyntaxError('PRIVATE'); } });
  const response = {
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = JSON.parse(body); }
  };
  const send = async (...args) => {
    calls.push(args);
    return fetchImpl ? fetchImpl(...args) : { ok: true, json: async () => ({ ok: true }) };
  };
  await createLeadHandler({ env: config, fetchImpl: send, reportFailure: details => reports.push(details) })(request, response);
  return { ...response, calls, reports };
}

test('streamed and Vercel-parsed requests send the same private message', async () => {
  for (const parsed of [false, true]) {
    const response = await invoke({ parsed });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.calls.length, 1);
    const [url, options] = response.calls[0];
    assert.equal(url, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`);
    const data = JSON.parse(options.body);
    assert.equal(data.chat_id, '42');
    assert.match(data.text, /Test/);
    assert.match(data.text, /Package 40 EUR/);
    assert.ok(data.text.includes(`Telegram: ${lead.telegram}\nТелефон: ${lead.phone}`));
    assert.equal(data.parse_mode, undefined);
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok(!JSON.stringify(response.body).includes(env.TELEGRAM_BOT_TOKEN));
  }
});

test('only POST JSON is accepted', async () => {
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await invoke({ method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.Allow, 'POST');
    assert.equal(response.calls.length, 0);
  }
  for (const type of ['', 'text/plain', 'application/x-www-form-urlencoded']) {
    assert.equal((await invoke({ headers: { 'content-type': type } })).status, 415);
  }
  assert.equal((await invoke({ headers: { 'content-type': 'application/json; charset=utf-8' } })).status, 200);
});

test('malformed JSON, null, arrays and invalid fields return 400', async () => {
  for (const raw of ['{', 'null', '[]', 'true', '"text"']) assert.equal((await invoke({ raw })).status, 400);
  for (const payload of [{}, { ...lead, name: ' ' }, { ...lead, phone: '' }, { ...lead, name: {} }, { ...lead, phone: 123 }, { ...lead, telegram: {} }, { ...lead, website: [] }]) {
    const response = await invoke({ payload });
    assert.equal(response.status, 400);
    assert.equal(response.calls.length, 0);
  }
});

test('Vercel JSON helper exceptions are treated as bad requests, not upstream failures', async () => {
  const response = await invoke({ bodyGetterError: true });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { ok: false, error: 'invalid_json' });
  assert.equal(response.calls.length, 0);
});

test('body size is bounded in bytes, for raw and parsed requests', async () => {
  assert.equal((await invoke({ headers: { 'content-length': '10001' } })).status, 413);
  for (const parsed of [true, false]) {
    assert.equal((await invoke({ payload: { ...lead, message: 'x'.repeat(11000) }, parsed })).status, 413);
    assert.equal((await invoke({ payload: { ...lead, message: '\u044f'.repeat(6000) }, parsed })).status, 413);
  }
  assert.equal((await invoke({ raw: ['{"name":"', 'x'.repeat(11000), '"}'] })).status, 413);
});

test('cross-origin browser requests are rejected, same-origin aliases work', async () => {
  for (const origin of ['https://other.example', 'null', 'https://olgraprem.org.ua.other.example', 'ftp://olgraprem.org.ua']) {
    const response = await invoke({ headers: { origin } });
    assert.equal(response.status, 403);
    assert.equal(response.calls.length, 0);
  }
  assert.equal((await invoke({ headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  for (const host of ['olgraprem.org.ua', 'www.olgraprem.org.ua', 'project-preview.vercel.app', 'localhost:3000']) {
    assert.equal((await invoke({ headers: { host, origin: `https://${host}` } })).status, 200);
  }
});

test('honeypot quietly filters simple bots without calling Telegram', async () => {
  const response = await invoke({ payload: { ...lead, website: 'spam.example' } });
  assert.equal(response.status, 200);
  assert.equal(response.calls.length, 0);
});

test('normalization limits fields and prevents forged message headings', async () => {
  const response = await invoke({ payload: { ...lead, name: `${'x'.repeat(100)}\nInjected${'x'.repeat(30)}`, source: 'source\r\nInjected', message: 'x'.repeat(801), language: 'invalid' } });
  const text = JSON.parse(response.calls[0][1].body).text;
  assert.ok(!text.includes('x'.repeat(801)));
  assert.ok(text.includes('x'.repeat(800)));
  assert.match(text, /source +Injected/);
  assert.ok(text.includes(`${'x'.repeat(100)} Injected`));
  assert.ok(!text.includes('\nInjected'));
  assert.ok(text.includes('uk'));
});

test('Telegram is mandatory for both local streams and Vercel-parsed requests', async () => {
  for (const parsed of [false, true]) {
    for (const telegram of [undefined, '', '   ']) {
      const response = await invoke({ payload: { ...lead, telegram }, parsed });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'required_fields');
      assert.equal(response.calls.length, 0);
    }
  }
});

test('Telegram accepts an optional @, normalizes it, and rejects malformed usernames', async () => {
  for (const telegram of ['test_user', '@test_user', '  @Test_User  ', '@abc', `@${'a'.repeat(32)}`]) {
    const response = await invoke({ payload: { ...lead, telegram } });
    assert.equal(response.status, 200);
    const message = JSON.parse(response.calls[0][1].body).text;
    assert.ok(message.includes(`Telegram: @${telegram.trim().replace(/^@/, '')}\n`));
  }
  for (const telegram of ['@', '@@test_user', '@test user', 'https://t.me/test_user', '@тест', '@test\nInjected', `@${'a'.repeat(33)}`]) {
    const response = await invoke({ payload: { ...lead, telegram } });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'invalid_telegram');
    assert.equal(response.calls.length, 0);
  }
});

test('the phone field only accepts telephone numbers, never Telegram usernames', async () => {
  for (const phone of ['+380 (67) 123-45-67', '0671234567', '+44 20 7946 0958']) {
    assert.equal((await invoke({ payload: { ...lead, phone } })).status, 200);
  }
  for (const phone of ['@test_user', 'test_user', 'https://t.me/test_user', '123', '+1234567890123456', '-------']) {
    const response = await invoke({ payload: { ...lead, phone } });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'invalid_phone');
    assert.equal(response.calls.length, 0);
  }
});

test('missing credentials never cause a network call', async () => {
  for (const config of [{}, { TELEGRAM_BOT_TOKEN: 'x' }, { TELEGRAM_CHAT_ID: '42' }]) {
    const response = await invoke({ config });
    assert.equal(response.status, 503);
    assert.equal(response.calls.length, 0);
  }
});

test('Telegram HTTP, API, JSON and network failures are not false successes', async () => {
  const failures = [
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({ ok: false, description: 'PRIVATE' }) }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('PRIVATE'); } }),
    async () => { throw new Error('PRIVATE'); }
  ];
  for (const fetchImpl of failures) {
    const response = await invoke({ fetchImpl });
    assert.equal(response.status, 502);
    assert.ok(!JSON.stringify(response.body).includes('PRIVATE'));
  }
  for (const name of ['TimeoutError', 'AbortError']) {
    const response = await invoke({ fetchImpl: async () => { throw Object.assign(new Error('PRIVATE'), { name }); } });
    assert.equal(response.status, 504);
  }
});

test('Vercel entry point is the shared server handler', () => {
  assert.equal(require('../api/apply.js'), require('../lib/lead-handler.js').handleLead);
});

test('Telegram diagnostic codes never include raw descriptions, secrets or chat IDs', async () => {
  const cases = [
    [401, { error_code: 401, description: 'Unauthorized PRIVATE' }, 'telegram_invalid_token'],
    [404, { error_code: 404, description: 'Not Found PRIVATE' }, 'telegram_invalid_token'],
    [400, { error_code: 400, description: 'Bad Request: chat not found PRIVATE' }, 'telegram_chat_not_found'],
    [403, { error_code: 403, description: 'Forbidden PRIVATE' }, 'telegram_forbidden'],
    [429, { error_code: 429, description: 'PRIVATE' }, 'telegram_rate_limited'],
    [400, { error_code: 400, description: 'PRIVATE', parameters: { migrate_to_chat_id: -100987654321 } }, 'telegram_chat_migrated']
  ];
  for (const [status, data, expected] of cases) {
    const response = await invoke({ fetchImpl: async () => ({ status, ok: false, json: async () => ({ ok: false, ...data }) }) });
    assert.equal(response.status, 502);
    assert.equal(response.body.error, expected);
    assert.deepEqual(response.reports, [{ reason: expected, telegramStatus: status }]);
    const diagnostic = JSON.stringify({ body: response.body, reports: response.reports });
    for (const secret of ['PRIVATE', '-100987654321', env.TELEGRAM_BOT_TOKEN, lead.name, lead.telegram, lead.phone]) assert.ok(!diagnostic.includes(secret));
  }
});
