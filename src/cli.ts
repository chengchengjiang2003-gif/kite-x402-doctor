#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { diagnose, formatReport, validateHttpUrl, type Network } from './doctor.js';

const help = `Usage: kite-x402-doctor check --url <endpoint> --network testnet|mainnet [--rpc <url>] [--json]
Read-only diagnostics: one eth_chainId RPC and one unpaid GET. No signing or payments.
Exit codes: 0 checks passed; 1 diagnostic failure; 2 invalid arguments.
Use a GET endpoint that returns an x402 v2 PAYMENT-REQUIRED challenge.
`;

async function main(): Promise<void> {
  let options;
  let json = false;
  try {
    const { values, positionals } = parseArgs({
      options: { url: { type: 'string' }, network: { type: 'string' },
        rpc: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
      allowPositionals: true, strict: true,
    });
    json = values.json === true;
    if (values.help) { process.stdout.write(help); return; }
    if (positionals.length !== 1 || positionals[0] !== 'check' || !values.url ||
      (values.network !== 'testnet' && values.network !== 'mainnet')) throw new Error();
    options = { url: validateHttpUrl(values.url), network: values.network as Network,
      ...(values.rpc !== undefined ? { rpc: validateHttpUrl(values.rpc) } : {}) };
  } catch {
    const error = { error: 'invalid_arguments', message: 'Use check with --url and --network testnet|mainnet; see --help.' };
    if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(error) + '\n');
    else process.stderr.write(error.message + '\n');
    process.exitCode = 2;
    return;
  }
  const report = await diagnose(options);
  process.stdout.write((json ? JSON.stringify(report, null, 2) : formatReport(report)) + '\n');
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(() => {
  process.stderr.write('Diagnostic could not complete.\n');
  process.exitCode = 1;
});
