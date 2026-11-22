export type Network = 'testnet' | 'mainnet';

export const NETWORKS = Object.freeze({
  testnet: Object.freeze({ chainId: 2368, caip2: 'eip155:2368',
    rpc: 'https://rpc-testnet.gokite.ai', asset: '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A' }),
  mainnet: Object.freeze({ chainId: 2366, caip2: 'eip155:2366',
    rpc: 'https://rpc.gokite.ai', asset: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e' }),
});

export interface Check { id: string; status: 'pass' | 'fail'; detail: string; code?: 'request_timeout' }
export interface Report {
  schemaVersion: 1;
  checkedAt: string;
  network: Network;
  readOnly: true;
  settlementVerified: false;
  ok: boolean;
  checks: Check[];
}
export interface Options { url: string; network: Network; rpc?: string; timeoutMs?: number }

export function validateHttpUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Use an absolute HTTP(S) URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('Use an HTTP(S) URL without embedded credentials or a fragment.');
  }
  return url.href;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function address(value: unknown): boolean {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
}

/** Validate advertised metadata only. This never authorizes a payment. */
export function inspectChallenge(header: string | null, network: Network): Check[] {
  const checks: Check[] = [];
  const add = (id: string, pass: boolean, detail: string) =>
    checks.push({ id, status: pass ? 'pass' : 'fail', detail });
  if (!header) {
    add('challenge.header', false, 'PAYMENT-REQUIRED header is missing.');
    return checks;
  }
  let payload: unknown;
  try {
    if (header.length > 16384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(header)) {
      throw new Error();
    }
    const bytes = Buffer.from(header, 'base64');
    if (bytes.toString('base64') !== header) throw new Error();
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!record(payload)) throw new Error();
  } catch {
    add('challenge.header', false, 'Header must be standard base64 UTF-8 JSON (at most 16 KiB encoded).');
    return checks;
  }
  add('challenge.header', true, 'Decoded standard base64 JSON.');
  add('challenge.version', payload.x402Version === 2, 'Expected x402Version 2.');
  let validResource = false;
  if (record(payload.resource) && typeof payload.resource.url === 'string') {
    try { validateHttpUrl(payload.resource.url); validResource = true; } catch { /* Invalid metadata. */ }
  }
  add('challenge.resource', validResource, 'Expected an HTTP(S) resource URL.');
  const candidates = Array.isArray(payload.accepts) ? payload.accepts.filter(record) : [];
  const expected = NETWORKS[network];
  const validAmount = (value: unknown) => typeof value === 'string' &&
    /^[1-9][0-9]{0,77}$/.test(value) && BigInt(value) < (1n << 256n);
  const validTimeout = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
  const valid = (option: Record<string, unknown>) => option.scheme === 'exact' &&
    option.network === expected.caip2 && typeof option.asset === 'string' &&
    option.asset.toLowerCase() === expected.asset.toLowerCase() && address(option.payTo) &&
    validAmount(option.amount) && validTimeout(option.maxTimeoutSeconds);
  const option = candidates.find(valid) || candidates.find(item => item.network === expected.caip2) || candidates[0];
  add('challenge.accepts', !!option, 'Expected at least one payment option.');
  if (!option) return checks;
  add('challenge.scheme', option.scheme === 'exact', 'Expected the exact payment scheme.');
  add('challenge.network', option.network === expected.caip2, `Expected ${expected.caip2}.`);
  add('challenge.asset', typeof option.asset === 'string' &&
    option.asset.toLowerCase() === expected.asset.toLowerCase(), 'Expected the configured Kite network asset.');
  add('challenge.recipient', address(option.payTo), 'Expected a nonzero 20-byte recipient address. Ownership is not verified.');
  add('challenge.amount', validAmount(option.amount), 'Expected a positive decimal uint256 amount in atomic units.');
  add('challenge.timeout', validTimeout(option.maxTimeoutSeconds), 'Expected a positive integer maxTimeoutSeconds.');
  return checks;
}

async function readRpcJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) throw new Error();
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}

export async function diagnose(options: Options): Promise<Report> {
  if (options.network !== 'testnet' && options.network !== 'mainnet') throw new Error('Unknown Kite network.');
  const url = validateHttpUrl(options.url);
  const config = NETWORKS[options.network];
  const rpc = validateHttpUrl(options.rpc ?? config.rpc);
  const timeout = options.timeoutMs ?? 8000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000) throw new Error('Invalid timeout.');
  const checks: Check[] = [];
  const rpcTimeout = AbortSignal.timeout(timeout);
  try {
    const response = await fetch(rpc, {
      method: 'POST', redirect: 'manual', signal: rpcTimeout,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    });
    const data = await readRpcJson(response);
    const correct = response.ok && record(data) && data.jsonrpc === '2.0' && data.id === 1 &&
      !Object.hasOwn(data, 'error') && typeof data.result === 'string' && /^0x[0-9a-fA-F]+$/.test(data.result) &&
      BigInt(data.result) === BigInt(config.chainId);
    checks.push({ id: 'rpc.chain', status: correct ? 'pass' : 'fail',
      detail: `Expected JSON-RPC eth_chainId ${config.chainId} with matching response id.` });
  } catch {
    checks.push(rpcTimeout.aborted
      ? { id: 'rpc.chain', status: 'fail', detail: 'RPC request timed out.', code: 'request_timeout' }
      : { id: 'rpc.chain', status: 'fail', detail: 'RPC unavailable or returned invalid/oversized JSON.' });
  }
  const httpTimeout = AbortSignal.timeout(timeout);
  try {
    const response = await fetch(url, {
      method: 'GET', headers: { Accept: 'application/json' },
      redirect: 'manual', signal: httpTimeout,
    });
    try {
      checks.push({ id: 'http.status', status: response.status === 402 ? 'pass' : 'fail',
        detail: `Observed HTTP ${response.status}; expected 402. Redirects are not followed.` });
      if (response.status === 402) checks.push(...inspectChallenge(response.headers.get('payment-required'), options.network));
    } finally { await response.body?.cancel().catch(() => {}); }
  } catch {
    checks.push(httpTimeout.aborted
      ? { id: 'http.status', status: 'fail', detail: 'Endpoint request timed out.', code: 'request_timeout' }
      : { id: 'http.status', status: 'fail', detail: 'Endpoint unavailable or returned an invalid response.' });
  }
  return { schemaVersion: 1, checkedAt: new Date().toISOString(), network: options.network,
    readOnly: true, settlementVerified: false,
    ok: checks.every(check => check.status === 'pass'), checks };
}

export function formatReport(report: Report): string {
  return [`Kite x402 Doctor — ${report.network}`, ...report.checks.map(check =>
    `[${check.status.toUpperCase()}] ${check.id}: ${check.detail}`),
  'Read-only observations. Payment and settlement were not verified.'].join('\n');
}
