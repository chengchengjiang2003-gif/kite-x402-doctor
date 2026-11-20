import { createServer } from 'node:http';

const challenge = Buffer.from(JSON.stringify({
  x402Version: 2, resource: { url: 'http://127.0.0.1:8403/paid' },
  accepts: [{ scheme: 'exact', network: 'eip155:2368',
    asset: '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
    payTo: '0x1111111111111111111111111111111111111111',
    amount: '1000', maxTimeoutSeconds: 60 }],
})).toString('base64');

createServer(async (req, res) => {
  if (req.url === '/rpc' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const request = JSON.parse(body);
      if (request.method !== 'eth_chainId') throw new Error();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: '0x940' }));
    } catch { res.writeHead(400); res.end('Only eth_chainId is supported.'); }
  } else if (req.url === '/paid' && req.method === 'GET') {
    res.writeHead(402, { 'PAYMENT-REQUIRED': challenge });
    res.end('Simulated x402 challenge; no payments are accepted.');
  } else { res.writeHead(404); res.end(); }
}).listen(8403, '127.0.0.1', () => {
  console.log('Local simulation only: http://127.0.0.1:8403 (Ctrl+C to stop)');
});
