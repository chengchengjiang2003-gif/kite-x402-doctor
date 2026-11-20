import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { diagnose, inspectChallenge, formatReport, NETWORKS } from '../dist/doctor.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const exec = promisify(execFile);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64');
function challenge(network = 'testnet') {
  return { x402Version: 2, resource: { url: 'https://example.com/v1/echo' }, accepts: [{
    scheme: 'exact', network: NETWORKS[network].caip2, asset: NETWORKS[network].asset,
    payTo: '0x1111111111111111111111111111111111111111', amount: '1000', maxTimeoutSeconds: 60,
  }] };
}
const passed = checks => checks.every(check => check.status === 'pass');

for (const network of ['testnet', 'mainnet']) {
  test(`valid ${network} challenge`, () => {
    assert.equal(passed(inspectChallenge(encode(challenge(network)), network)), true);
  });
}

for (const [name, mutate, id] of [
  ['wrong version', p => { p.x402Version = 1; }, 'challenge.version'],
  ['missing version', p => { delete p.x402Version; }, 'challenge.version'],
  ['missing resource', p => { delete p.resource; }, 'challenge.resource'],
  ['wrong network', p => { p.accepts[0].network = 'eip155:1'; }, 'challenge.network'],
  ['wrong asset', p => { p.accepts[0].asset = '0x2222222222222222222222222222222222222222'; }, 'challenge.asset'],
  ['bad recipient', p => { p.accepts[0].payTo = '0x123'; }, 'challenge.recipient'],
  ['zero recipient', p => { p.accepts[0].payTo = '0x' + '0'.repeat(40); }, 'challenge.recipient'],
  ['wrong scheme', p => { p.accepts[0].scheme = 'other'; }, 'challenge.scheme'],
  ['empty options', p => { p.accepts = []; }, 'challenge.accepts'],
  ['null options', p => { p.accepts = [null]; }, 'challenge.accepts'],
  ['zero timeout', p => { p.accepts[0].maxTimeoutSeconds = 0; }, 'challenge.timeout'],
  ['fractional timeout', p => { p.accepts[0].maxTimeoutSeconds = 1.5; }, 'challenge.timeout'],
]) {
  test(name, () => {
    const p = challenge(); mutate(p);
    assert.equal(inspectChallenge(encode(p), 'testnet').find(c => c.id === id)?.status, 'fail');
  });
}
for (const amount of ['0', '-1', '1.2', '01', '1e6', '', 1000, (1n << 256n).toString()]) {
  test(`reject invalid amount ${amount}`, () => {
    const p = challenge(); p.accepts[0].amount = amount;
    assert.equal(inspectChallenge(encode(p), 'testnet').find(c => c.id === 'challenge.amount').status, 'fail');
  });
}
test('uint256 maximum and mixed-case asset are accepted', () => {
  const p = challenge(); p.accepts[0].amount = ((1n << 256n) - 1n).toString();
  p.accepts[0].asset = '0x' + p.accepts[0].asset.slice(2).toUpperCase();
  assert.equal(passed(inspectChallenge(encode(p), 'testnet')), true);
});
for (const header of [null, '', '!not-base64', encode([]), encode(null), 'e30', 'a'.repeat(16388),
  Buffer.from([0xff]).toString('base64'), Buffer.from('{').toString('base64')]) {
  test(`reject missing or malformed header ${String(header).slice(0, 20)}`, () => {
    assert.equal(passed(inspectChallenge(header, 'testnet')), false);
  });
}
test('selects one complete matching option instead of mixing fields across options', () => {
  const p = challenge(); p.accepts.unshift(challenge('mainnet').accepts[0]);
  assert.equal(passed(inspectChallenge(encode(p), 'testnet')), true);
  p.accepts[1].amount = '0';
  assert.equal(passed(inspectChallenge(encode(p), 'testnet')), false);
});

async function fixture(run, settings = {}) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, method: req.method, headers: req.headers, body });
    if (settings.hang === req.url) return;
    if (req.url === '/rpc') {
      res.writeHead(settings.rpcStatus ?? 200, { 'Content-Type': 'application/json' });
      res.end(settings.rpcRaw ?? JSON.stringify(settings.rpc ?? { jsonrpc: '2.0', id: 1, result: '0x940' }));
    } else {
      const headers = settings.noHeader ? {} : { 'PAYMENT-REQUIRED': settings.header ?? encode(challenge()) };
      res.writeHead(settings.status ?? 402, { ...headers, Location: '/redirected' });
      res.end('fixture');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run({ url: base + '/paid', rpc: base + '/rpc', network: 'testnet' }, requests); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('end-to-end diagnostics make only eth_chainId and one unpaid GET', async () => {
  await fixture(async (options, requests) => {
    const report = await diagnose(options);
    assert.equal(report.ok, true);
    assert.equal(report.readOnly, true);
    assert.equal(report.settlementVerified, false);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].method, 'POST');
    assert.deepEqual(JSON.parse(requests[0].body), { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] });
    assert.equal(requests[1].method, 'GET');
    assert.equal(requests[1].body, '');
    for (const request of requests) {
      for (const header of ['payment-signature', 'x-payment', 'authorization', 'cookie']) assert.equal(request.headers[header], undefined);
    }
    assert.match(formatReport(report), /Payment and settlement were not verified/);
    for (const check of report.checks) assert.ok(formatReport(report).includes(check.id));
  });
});
for (const settings of [
  { status: 200 }, { status: 302 }, { noHeader: true }, { header: 'invalid' },
  { rpc: { jsonrpc: '2.0', id: 1, result: '0x1' } },
  { rpc: { jsonrpc: '2.0', id: 2, result: '0x940' } },
  { rpc: { jsonrpc: '2.0', id: 1, result: '0x940', error: { code: -1 } } },
  { rpcStatus: 500 }, { rpcRaw: 'not-json' }, { rpcRaw: ' '.repeat(65537) },
]) {
  test(`observed failure ${JSON.stringify(settings).slice(0, 85)}`, async () => {
    await fixture(async (options, requests) => {
      assert.equal((await diagnose(options)).ok, false);
      assert.equal(requests.length, 2, 'no retries or redirect follow-ups');
    }, settings);
  });
}
for (const path of ['/rpc', '/paid']) {
  test(`timeout at ${path}`, async () => {
    await fixture(async options => {
      assert.equal((await diagnose({ ...options, timeoutMs: 100 })).ok, false);
    }, { hang: path });
  });
}
test('connection failures produce failed observations', async () => {
  const report = await diagnose({ url: 'http://127.0.0.1:1', rpc: 'http://127.0.0.1:1', network: 'testnet' });
  assert.equal(report.ok, false);
  assert.equal(report.checks.length, 2);
});

async function runCli(args) {
  try { return { ...(await exec(process.execPath, [cli, ...args])), code: 0 }; }
  catch (error) { return { stdout: error.stdout, stderr: error.stderr, code: error.code }; }
}
test('CLI JSON success and human output use the same checks', async () => {
  await fixture(async options => {
    const args = ['check', '--url', options.url, '--rpc', options.rpc, '--network', 'testnet'];
    const json = await runCli([...args, '--json']);
    assert.equal(json.code, 0, json.stderr);
    const report = JSON.parse(json.stdout);
    assert.equal(report.ok, true);
    const human = await runCli(args);
    assert.equal(human.code, 0);
    assert.equal(human.stdout.trimEnd(), formatReport(report));
  });
});
test('CLI diagnostic failure exits 1', async () => {
  await fixture(async options => {
    const result = await runCli(['check', '--url', options.url, '--rpc', options.rpc, '--network', 'testnet', '--json']);
    assert.equal(result.code, 1);
    assert.equal(JSON.parse(result.stdout).ok, false);
  }, { status: 200 });
});
for (const args of [[], ['check'], ['check', '--network', 'other', '--url', 'https://example.com'],
  ['check', '--network', 'testnet', '--url', 'file:///tmp/test'],
  ['check', '--network', 'testnet', '--url', 'https://user:secret@example.com'],
  ['check', '--network', 'testnet', '--url', 'https://example.com', '--unknown'],
  ['check', '--network', 'testnet', '--url', 'https://example.com', '--rpc', '']]) {
  test(`CLI argument rejection ${JSON.stringify(args)}`, async () => {
    const result = await runCli([...args, '--json']);
    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error, 'invalid_arguments');
    assert.doesNotMatch(result.stdout + result.stderr, /user:secret/);
  });
}
test('CLI help needs no endpoint', async () => {
  const result = await runCli(['--help']);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage:/);
});
