# Kite x402 Doctor

A read-only command-line tool for Kite service developers. It checks the selected Kite RPC chain ID and the x402 v2 payment challenge advertised by a GET endpoint. It does not load a wallet, sign, pay, or verify settlement.

## Requirements and installation

Node.js 22 or later and npm are required.

```sh
npm ci
npm test
node dist/cli.js --help
```

Build a distributable package with `npm pack`. Install the resulting tarball using `npm install -g ./kite-x402-doctor-0.1.0.tgz`, then run `kite-x402-doctor --help`. This project has not been published to npm; use the local tarball.

## Usage

```sh
node dist/cli.js check --url https://YOUR-SERVICE/v1/endpoint --network testnet --json
```

Replace the placeholder with a GET endpoint you operate or are authorized to inspect. Use `--rpc https://YOUR-RPC` to override the selected network's default RPC. Omit `--json` for a readable report. The CLI does not automatically load `.env` files.

Each run makes one `eth_chainId` JSON-RPC request and one unpaid GET. It follows no redirects and performs no retries. Each request has an eight-second timeout by default. Use `--timeout-ms <ms>` to set a per-request limit between 1 and 60000 milliseconds. RPC JSON is limited to 64 KiB; the encoded challenge header is limited to 16 KiB, subject to the HTTP client's own header limit. The paid endpoint's response body is discarded.

In JSON output, a timed-out check has `code: "request_timeout"`. Its `id` identifies whether the RPC request (`rpc.chain`) or the endpoint request (`http.status`) timed out. Other checks omit `code`.

Exit codes: **0** means the listed checks passed, **1** means a diagnostic failed, and **2** means invalid command arguments. A passed check does not verify recipient ownership, balances, token contract behavior, EIP-712 signing, or settlement. Other payment schemes and x402 v1 are outside v0.1.

## Reproducible local demonstration

```sh
npm run build
node examples/mock-server.mjs
```

In another terminal:

```sh
node dist/cli.js check --url http://127.0.0.1:8403/paid --rpc http://127.0.0.1:8403/rpc --network testnet --json
```

The local server is a protocol fixture. Its chain ID and challenge are simulated; no connection to Kite or settlement is implied. Stop it with Ctrl+C.

## Kite ecosystem connection

`src/doctor.ts` defines Kite mainnet (`eip155:2366`) and testnet (`eip155:2368`), their RPC defaults and network-specific assets. `diagnose()` checks actual RPC/HTTP observations; `inspectChallenge()` checks the selected network, asset, `exact` scheme, recipient format, positive uint256 amount and timeout. A report always contains `readOnly: true` and `settlementVerified: false`.

This is an independent developer tool. It does not wrap or copy the Explorer implementation. The engineering comparison and sources for network metadata are documented in [REFERENCE_REVIEW](docs/REFERENCE_REVIEW.md). This release does not claim Electric Capital inclusion; Open Dev Data registration is pending and must be checked separately from contribution attribution.

## Development and maintenance

- [Architecture](docs/ARCHITECTURE.md)
- [CLI and library interface](docs/USAGE.md)
- [Testing, packaging and troubleshooting](docs/TESTING_AND_DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

Licensed under MIT. Review all generated changes and test results before publishing or using them as contribution evidence.
