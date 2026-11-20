# CLI and library usage

```text
kite-x402-doctor check --url <endpoint> --network testnet|mainnet [--rpc <url>] [--json]
```

`--url` and `--network` are required. `--rpc` overrides the network default. `--json` writes the report to stdout; the human format does the same without that flag. `--help` works without a URL and exits successfully. Unknown options, unsupported networks and invalid URLs exit 2. URLs must be HTTP(S), without embedded user/password credentials or a fragment.

## Report contract

The JSON report contains `schemaVersion: 1`, an ISO `checkedAt`, `network`, `readOnly: true`, `settlementVerified: false`, `ok`, and a `checks` array. Every check contains `id`, `status` (`pass` or `fail`) and `detail`. Treat `detail` as explanatory text, not a stable error code; use the check IDs and status for automation.

Check IDs include `rpc.chain`, `http.status`, and `challenge.header`, `version`, `resource`, `accepts`, `scheme`, `network`, `asset`, `recipient`, `amount`, `timeout` under the `challenge.` prefix. Dependent checks are omitted if their input cannot be decoded. Unsupported HTTP status records a failed status without treating arbitrary headers as an x402 challenge.

Invalid arguments in JSON mode produce `{ "error": "invalid_arguments", "message": "..." }` and exit 2. Diagnostics produce the complete report and exit 0 or 1. An unexpected internal failure exits 1 with a generic stderr message.

## Library

```js
import { diagnose, formatReport } from 'kite-x402-doctor';

const report = await diagnose({
  url: 'http://127.0.0.1:8403/paid',
  rpc: 'http://127.0.0.1:8403/rpc',
  network: 'testnet',
});
console.log(formatReport(report));
```

`diagnose(options)` returns a `Promise<Report>`. Invalid library options reject before requests. The optional library-only `timeoutMs` accepts integers from 1 through 60000, defaulting to 8000. `inspectChallenge(header, network)` performs offline inspection and returns `Check[]`; use only the two declared networks. Types are included in the tarball.

The operator must compare the advertised recipient to their intended service recipient separately. A valid address is not an identity or ownership check. Service errors, funded-call behavior and on-chain transfer effects require separate evidence.
