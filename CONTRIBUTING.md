# Contributing

Use Node.js 22 or later. Run `npm ci` and `npm test` before a focused PR. Reproduce a behavior bug with a failing regression test and keep the repair scoped to it. Include the problem, observable change and validation in the PR.

Preserve the read-only boundary: no wallet/private-key loading, signing, paid retries, raw credential logging or fabricated live evidence. Real endpoint failures must not fall back to simulated successes. Tests must work offline against local fixtures and verify the requests actually sent.

Use your own GitHub identity and associated commit email. Preserve other contributors' authorship. Record meaningful changes in CHANGELOG and document changes to CLI arguments or report schema. Do not commit `.env`, credentials, dependencies or generated build artifacts.
