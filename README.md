# SarembokVE

[![CI](https://github.com/jetsontech/SarembokVE/actions/workflows/ci.yml/badge.svg)](https://github.com/jetsontech/SarembokVE/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

**Detect breaking API contract changes before they ship.**
SarembokVE loads a live site in headless Chromium, records the network calls it makes, produces an OpenAPI 3.1 document and TypeScript types, and (via `audit`) fails your CI when a response field or endpoint disappears or changes type compared with a committed baseline.

[Console](https://sarembok.com) · [Docs](https://sarembok.com/docs) · [Status](https://sarembok.com/status) · [Changelog](https://sarembok.com/changelog) · [Security](https://sarembok.com/security)

---

## Quick start

Requires Node 18+. Run from a clone of this repo (the package is **not yet published to npm**):

```bash
git clone https://github.com/jetsontech/SarembokVE && cd SarembokVE

# Extract a contract (prints TypeScript, or write a file)
node bin/sarembok.js spec https://httpbin.org
node bin/sarembok.js spec https://httpbin.org --out api.openapi.json --format openapi

# Drift gate: first run records .sarembok/baseline.json, later runs diff against it
node bin/sarembok.js audit https://httpbin.org
node bin/sarembok.js audit https://httpbin.org --update-baseline   # accept current state
```

`audit` exit codes: `0` no breaking change (or baseline just created), `1` breaking change or extraction failure. Use `--no-fail` to report without failing.

### What counts as drift

| Change | Result |
|---|---|
| Endpoint removed | **breaking** |
| Response field removed or its type changed | **breaking** |
| New endpoint or new response field | additive (reported, never fails) |

Only response shapes the browser actually observed are compared. Endpoints the page never calls are invisible to the tool.

### GitHub Actions

```yaml
- uses: actions/checkout@v4
- uses: jetsontech/SarembokVE@main
  with:
    target: https://staging.example.com
    # baseline: .sarembok/baseline.json
    # fail_on_drift: 'true'
```
Commit the baseline file so the gate has something to compare against.

---

## Measured behaviour

| Claim | Evidence |
|---|---|
| Spec extraction for `https://httpbin.org` | about 2.8 s end to end from the CLI (measured 2026-10-17, single run) |
| `audit` bypasses cache | uses `?fresh=1`; refuses to gate if the server answers from cache |
| Drift engine | 6 unit tests, run in CI (`npm test`) |

Live health from your own browser: [/status](https://sarembok.com/status).

## Limits you should know

- Observation-based: it sees what a real page load triggers, not your full API surface. Authenticated or user-action-only endpoints need headers/tokens (`--header`, `--token`) and may still be missed.
- Your target URL, and any header or token you pass, are sent to our servers, which fetch the target. Read [Security](https://sarembok.com/security) first. Audit only systems you are authorised to test.
- Not an API testing framework: it detects shape changes, not behavioural or business-logic regressions.
- No uptime history, SLA, or compliance certification exists yet.

## Also in this repository (experimental, not benchmarked)

The hosted console also contains a chat workspace with live quote/preprint/news lookups, a memory timeline, a voice interface and a 3D avatar viewer, plus a worker protocol for attaching your own GPU. These are experiments around the core tool. They have not been independently benchmarked, carry no stated performance guarantees, and may change or be removed. Source: `Deployment/cloud/`, `frontend/`, `fabric/`.

## Development

```bash
npm test                          # drift engine unit tests
SAREMBOK_HOST=http://localhost:9000 node bin/sarembok.js health   # point the CLI at your own server
```

## License

Apache-2.0. See [LICENSE](LICENSE).
