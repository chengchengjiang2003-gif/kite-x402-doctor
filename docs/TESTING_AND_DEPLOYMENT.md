# Testing and deployment

## Clean checkout

```sh
npm ci
npm test
npm pack
```

`npm test` compiles TypeScript and runs Node's test runner. The tests start HTTP servers on loopback interfaces; they require permission to bind local ephemeral ports. No real wallet, paid endpoint, faucet tokens or external RPC is required. CI runs this command with Node.js 22 and the committed lockfile.

Coverage includes both network profiles, malformed base64 and UTF-8, required fields, multiple payment options, amount boundaries, incorrect RPC IDs and chain IDs, oversized/invalid RPC responses, HTTP failures, redirects, connection failures, deadlines, argument parsing, report formatting and exit codes. End-to-end tests inspect the actual HTTP requests and assert that no payment headers or credentials are sent.

## Local fixture

Run `node examples/mock-server.mjs`, then use the loopback command in README. The fixture provides `/rpc` and `/paid` on port 8403. These observations are simulated. For an actual deployment, supply its unpaid GET endpoint and the selected chain RPC. Never present the fixture as evidence of a live chain or successful payment.

## Package validation

Run `npm pack --dry-run` and inspect the files. Run `npm pack`, install the resulting local tarball in an empty directory using `npm install --ignore-scripts /absolute/path/to/tarball`, and execute the installed `dist/cli.js --help` plus the fixture check. The package includes compiled JS and declarations; production needs no TypeScript compiler or runtime dependencies.

This is a local CLI, so no server deployment is required. A user may invoke it from their own CI and retain the JSON report as an artifact. A failed live check must remain a failed result, even if local tests pass.

## Troubleshooting

- Exit 2: check the spelling of options and supply both URL and network.
- RPC failure: verify network reachability and an RPC accepting unauthenticated `eth_chainId`, or supply an authorized custom RPC URL.
- HTTP 200/404: use a GET route that actually issues x402 challenges; a health or facilitator capabilities endpoint is not a paid route.
- HTTP 3xx: use the final intended URL explicitly. Redirects are deliberately not followed.
- Challenge failure: inspect the server configuration. v0.1 supports only standard base64 x402 v2 `exact` metadata for the configured Kite assets.
- Timeout: investigate the server or network. The CLI performs no automatic retries.

Current limits: GET-only probes, chain-ID verification rather than chain authenticity proof, address syntax rather than recipient identity, no funded payment/settlement checks, no automatic EC or Open Dev Data registration.
