# Architecture

The CLI validates arguments before contacting a network. `src/cli.ts` calls the reusable `diagnose()` function in `src/doctor.ts`, renders the returned checks, and selects the exit code. Human and JSON output derive from the same report.

`diagnose()` validates the URL and network, checks `eth_chainId`, then inspects one unpaid GET. RPC failure does not suppress the HTTP observation. The report passes only when every recorded check passes. JSON-RPC responses must match version 2.0 and request ID 1, have the configured hexadecimal chain ID, and contain no error member.

`inspectChallenge()` strictly decodes standard padded base64 and UTF-8 JSON. It validates version and resource metadata and searches for one complete supported payment option. Fields from different options are never combined. Unknown additional metadata is ignored. A malformed or missing challenge remains a failed observation.

Network requests use Node's built-in fetch. There are no runtime dependencies, wallet integrations, background jobs, caches, external telemetry, or persistent application state. Requests have deadlines; RPC responses have a body-size limit. Redirects and automatic payment retries are disabled.

The CLI is intended to run locally under the operator's control, including against local development services. Do not expose it as a public URL-checking API without a separate outbound access policy. URLs may contain query credentials supplied by the operator; reports intentionally omit raw URLs, headers, remote response bodies and raw parser exceptions.
