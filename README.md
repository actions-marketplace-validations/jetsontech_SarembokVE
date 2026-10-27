# SarembokVE

[![CI](https://github.com/jetsontech/SarembokVE/actions/workflows/ci.yml/badge.svg)](https://github.com/jetsontech/SarembokVE/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Tests: 19 Passing](https://img.shields.io/badge/Tests-19%20Passing-brightgreen.svg)](test/)
[![Security: NVIDIA OpenShell](https://img.shields.io/badge/Security-NVIDIA%20OpenShell%20Zero--Trust-blueviolet.svg)](Docs/SECURITY.md)

**AI-Native Computing Environment, Autonomous Multi-Sector Intelligence, and NVIDIA OpenShell Zero-Trust Security Control Plane.**

SarembokVE bridges autonomous developer tooling with enterprise-grade runtime security:
1. **NVIDIA OpenShell Zero-Trust Runtime**: Enforces declarative deny-by-default execution boundaries outside the agent process, eliminates credential leakage via **Secret Zero Injection**, and gates critical mutations behind **Human-In-The-Loop (HITL)** approvals.
2. **Autonomous Contract Reverse-Engineering**: Loads live target applications in capability-dropped Chromium sandboxes, records network interaction patterns, synthesizes OpenAPI 3.1 contracts and TypeScript types, and gates CI/CD pipelines against breaking API drift.
3. **Shannon Entropy Loop Defense ($H(X) \ge 0.88$)**: Continuously evaluates state entropy to mathematically detect and halt recursive agent hallucinations and execution loops with real-time vector SVG rollback maps.
4. **Sovereign Multi-Tier Intelligence & Memory**: Multi-sector real-time grounding, zero-locking SQLite-WAL persistent memory, semantic reasoning cache, model fallback circuit breaker, and high-fidelity digital-human voice fabric.

[Console](https://sarembok.com) · [Solutions & 12 Use Cases](Docs/SOLUTIONS_AND_USE_CASES.md) · [Docs](https://sarembok.com/docs) · [Status](https://sarembok.com/status) · [Changelog](https://sarembok.com/changelog) · [Security Architecture](Docs/SECURITY.md)

---

## Unified Cross-Platform CLI (`sarembok`)

Requires Node 18+ (tested on Node 20 & 24 across Linux, macOS, and Windows):

```bash
# Clone the repository
git clone https://github.com/jetsontech/SarembokVE && cd SarembokVE

# Check CLI commands and help
node bin/sarembok-cli.js --help
```

### 1. NVIDIA OpenShell Zero-Trust Security Commands

```bash
# Inspect active containment profile & security posture
node bin/sarembok-cli.js openshell status

# View or switch containment profiles (strict, enterprise, audit, developer)
node bin/sarembok-cli.js openshell profile strict

# Dry-run verify a command against deny-by-default policies & HITL thresholds
node bin/sarembok-cli.js openshell verify "npm test"
node bin/sarembok-cli.js openshell verify "rm -rf /"       # ✕ Blocked immediately

# Execute an isolated command inside the OpenShell sandbox with Secret Zero injection
node bin/sarembok-cli.js openshell run "curl -H 'Authorization: Bearer {{SECRET:GITHUB_TOKEN}}' https://api.github.com/user"
```

### 2. Human-In-The-Loop (HITL) Governance

```bash
# List all pending high-risk actions awaiting operator authorization
node bin/sarembok-cli.js pending

# Approve or reject an authorization request
node bin/sarembok-cli.js approve hitl-xxxx
node bin/sarembok-cli.js reject hitl-xxxx "Unapproved production mutation"
```

### 3. Contract Drift Gating & API Synthesis

```bash
# Extract OpenAPI 3.1 & TypeScript contracts from a live web application
node bin/sarembok-cli.js spec https://httpbin.org --out api.openapi.json --format openapi

# Run CI/CD drift gate (first run sets baseline, subsequent runs diff against it)
node bin/sarembok-cli.js audit https://httpbin.org
node bin/sarembok-cli.js audit https://httpbin.org --update-baseline

# Export compliant, tamper-proof audit trails (SOC 2 / ISO 27001)
node bin/sarembok-cli.js audit export --format json --out ./audit_log.json
```

### 4. Engine & Substrate Management

```bash
# Start backend Python sovereign kernel and state ledgers
node bin/sarembok-cli.js engine start

# Start real-time digital-human WebSocket voice fabric (Port 9001)
node bin/sarembok-cli.js engine voice

# Provision ephemeral capability-dropped Chromium sandbox container
node bin/sarembok-cli.js engine provision https://httpbin.org

# Check cluster and session broker health
node bin/sarembok-cli.js health
```

### 5. Cognitive Optimization & Benchmarking

```bash
# Run Sarembok-Eval automated agentic regression suite (5 benchmarks)
node bin/sarembok-cli.js eval

# Inspect Semantic Reasoning Cache statistics & token savings
node bin/sarembok-cli.js cache stats

# Inspect active Model Fallback circuit breaker routes
node bin/sarembok-cli.js router
```

---

## Architectural Pillars

```
                               ┌─────────────────────────────────────────────────────┐
                               │           NVIDIA OpenShell Security Plane           │
                               │  - Deny-by-default YAML policy engine               │
                               │  - External Secret Zero credential injection        │
                               │  - Human-In-The-Loop (HITL) authorization gates     │
                               └──────────────────────────┬──────────────────────────┘
                                                          │ (Supervised Boundary)
                                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             SAREMBOK VE COGNITIVE CORE                                             │
├──────────────────────────────────────┬──────────────────────────────────────┬──────────────────────────────────────┤
│          Agent Architecture          │       Memory & Reasoning Layer       │         Autonomous Substrate         │
├──────────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
│ • Strategist Node                    │ • Non-blocking SQLite-WAL ledger     │ • Playwright DOM Sniffer             │
│ • Worker Node (with OpenShell Guard) │ • Shannon Entropy Loop Defense       │ • Ephemeral Chromium Sandbox         │
│ • Auditor Node                       │ • Semantic Reasoning Cache (40% cut) │ • Digital-Human Voice Fabric (9001)  │
│ • Asynchronous Protocol Message Bus  │ • Multi-Tier Model Fallback Router   │ • Dark-Mode SVG Visualizer           │
└──────────────────────────────────────┴──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## Security & Pre-Baked Containment Profiles

Configured via `Config/openshell.policy.yaml` and `Config/openshell.profiles.json`:

| Profile | Target Environment | Filesystem | Network Egress | HITL Required Actions | Secret Zero |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`strict`** (default) | Production / Banking | Read-only root | Whitelist only | All DB writes, financial, cloud destroy | Enforced |
| **`enterprise`** | Corporate Infrastructure | Read-only root | Whitelist + Intranet | Production DB, cloud destroy | Enforced |
| **`audit`** | Playwright Web Crawler | Read-only root | HTTP/HTTPS only | None (automated extraction) | Enforced |
| **`developer`** | Local Workstation | Read-write | Unrestricted | Financial transactions only | Optional |

---

## Development & Test Suite

All 19 automated unit tests run out-of-the-box:

```bash
npm test
```

Test coverage includes:
* Contract Diffing Engine & Breaking Change Gating (6 tests)
* Shannon Entropy Evaluator, Voice Fabric & Container Provisioning (4 tests)
* NVIDIA OpenShell Supervisor, Secret Zero & HITL Authorizations (4 tests)
* Semantic Cache, Model Fallback Router, Audit Exporter, Sarembok-Eval & HTML Visualizer (5 tests)

---

## License

Apache-2.0. See [LICENSE](LICENSE).
