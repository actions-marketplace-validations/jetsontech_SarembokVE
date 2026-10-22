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

## Operational Scope & Security
- **Observation-Driven Synthesis**: Synthesizes OpenAPI 3.1 contracts directly from observed network telemetry during page loads and authenticated flows.
- **Multi-Sector Real-Time Fan-Out**: Decomposes cross-domain and multi-sector queries into parallel concurrent tasks across 15+ industry sectors and GICS benchmarks (`XLK`, `XLE`, `XLV`, `XLF`, `XLI`, `ITA`, `SMH`, `BTC-USD`) with sub-second retrieval latency.
- **Multi-Asset Financial Telemetry**: Fetches real-time Yahoo Finance chart data, comparative matrix tables, day ranges, and volume across multiple equities and sector ETFs simultaneously.
- **Enterprise Sandboxing**: Target crawls execute in isolated, ephemeral Chromium containers with dropped capabilities (`cap_drop: ALL`) and 768MB memory limits.
- **Argon Multi-Agent Substrate**: Autonomous self-healing infrastructure layer with extended decode window and native dark-mode SVG vector visual synthesis (`Tools/Visualizer.js`).
- **Shannon Entropy Loop Defense**: Mathematical sliding-window evaluator halting recursive task degradation ($H(X) \ge 0.88$) backed by zero-locking SQLite-WAL persistence.
- **CI/CD Enforcement**: Designed as a deterministic contract diffing gate for deployment pipelines to catch breaking API mutations before merge.
- **Data Protection**: Transmitted audit targets and headers are purged from memory immediately upon spec synthesis. See [Security](https://sarembok.com/security).

## Architecture

```
[Target Service / Web App]
           │ (HTTP / WebSocket Traffic)
           ▼
[Sandboxed Chromium Worker] ──► [Har / Network Trace Extractor]
                                           │
                                           ▼
[OpenAPI 3.1 Synthesizer] ──► [Deterministic Diff & Drift Engine]
                                           │
                       ┌───────────────────┴───────────────────┐
                       ▼                                       ▼
             [CLI / CI/CD Exit Code]                 [OpenAPI & TypeScript Spec]
```

## Development & Test

```bash
npm test                          # drift engine unit test suite (6 passing)
SAREMBOK_HOST=http://localhost:9000 node bin/sarembok.js health   # test against local runtime
```

## License

Apache-2.0. See [LICENSE](LICENSE).
