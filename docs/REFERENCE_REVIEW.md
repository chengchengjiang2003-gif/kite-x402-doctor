# Reference review and originality

Reviewed on 2026-11-19. This review covers README files, repository structure, package/build configuration, selected core source and selected tests. It is not an audit of every file or a claim that all five projects were run locally.

| Reference | Source inspected | Engineering lesson |
| --- | --- | --- |
| [Explorer](https://github.com/CarryWang/kite-x402-explorer) | Network definitions, challenge parser, code generator, Node tests, CI | Separate demo data from observed evidence; keep a diagnostic report explicit about its scope |
| [Hono](https://github.com/BrKDDD/kite-x402-hono) | README, CONTRIBUTING, package configuration, payment-flow tests | Test verify/upstream/settle boundaries; its offline config preflight differs from this CLI's cross-service live inspection |
| [Axum](https://github.com/tianzeshi-study/kite-x402-axum) | Workspace configuration, README, protocol types and adjacent serialization tests | Keep wire-field casing exact and distinguish facilitator/readiness checks from settlement |
| [ZK Attestation](https://github.com/Anyi-zheng/kite-agent-zk-attestation) | README, package configuration, relay and pipeline source | Explicit verification is required before claiming a proof is valid; do not imply cryptographic guarantees from metadata |
| [Counter dApp](https://github.com/gokite-ai/kite_counter_dapp) | App entry, package configuration, Counter contract, recent repair PR | Small UI features still need a connected operational flow; this project avoids a UI that is unnecessary for its CLI use case |

Kite network IDs, RPC endpoints and asset addresses were cross-checked against [Explorer network definitions](https://github.com/CarryWang/kite-x402-explorer/blob/d5a2a6a9e6ade77ee38202c2aace9cc73373c7bf/src/types/kite.ts). The v2 wire field expectations were checked against [Axum protocol types](https://github.com/tianzeshi-study/kite-x402-axum/blob/main/kite-x402-axum/src/types.rs) and [Hono payment tests](https://github.com/BrKDDD/kite-x402-hono/blob/main/tests/payment.test.ts). Configuration may change; verify it before relying on a deployment.

A GitHub repository-name search for `kite x402 doctor` returned no matches at the time of review. This limited search does not prove the absence of similar tools.

The CLI's implementation and tests were written for this project. No source module from the references was copied. Network identifiers and protocol field names are interoperability data. AI assisted implementation and testing; the submitting developer remains responsible for review, understanding and maintenance.

Open Dev Data / Electric Capital status: not submitted or verified. A repository must first be published and its actual Kite technical relationship supplied to the organizers. Repository registration and developer attribution are separate checks.
