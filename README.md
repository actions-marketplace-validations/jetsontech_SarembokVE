# SarembokVE

[![CI](https://github.com/jetsontech/SarembokVE/actions/workflows/ci.yml/badge.svg)](https://github.com/jetsontech/SarembokVE/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Tests: 26 Passing](https://img.shields.io/badge/Tests-26%20Passing-brightgreen.svg)](test/)
[![Security: NVIDIA OpenShell](https://img.shields.io/badge/Security-NVIDIA%20OpenShell%20Zero--Trust-blueviolet.svg)](Docs/SECURITY.md)
[![ADR: Documented](https://img.shields.io/badge/Architecture-ADR--001%20Modular-informational.svg)](Docs/ADR.md)

**Modular AI-Native Computing Environment, Zero-Trust Execution Fabric, and Automated Contract Governance.**

SarembokVE is built with a **3-Tier Progressive Adoption Architecture**—ranging from a 30-second drop-in CI/CD GitHub Action for standard React/Next.js/Node web apps to an enterprise distributed agentic mesh with Raft consensus and SQLite-WAL state machines.

[Console](https://sarembok.com) · [Quickstart Guide](#quickstart-in-10-seconds) · [Solutions & 12 Use Cases](Docs/SOLUTIONS_AND_USE_CASES.md) · [Architecture Decision Records](Docs/ADR.md) · [Status](https://sarembok.com/status) · [Security Architecture](Docs/SECURITY.md)

---

## Progressive Adoption (Use Only What You Need)

You do **not** need to adopt SarembokVE as an "all-or-nothing" operating system. Choose the tier that matches your project's footprint:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Drop-In CI/CD Action  │ Zero-install OpenAPI 3.1 & drift gating  │ (30 Seconds)
├───────────────────────────────┼──────────────────────────────────────────┤
│ Tier 2: Standalone CLI        │ Zero-trust sandbox & policy supervisor   │ (Single Binary)
├───────────────────────────────┼──────────────────────────────────────────┤
│ Tier 3: Full Sovereign Mesh   │ Distributed Raft, SQLite-WAL, MCP server │ (Multi-Agent)
└──────────────────────────────────────────────────────────────────────────┘
```

### Tier 1: Drop-In GitHub Action (Zero-Install for Standard Web Apps)
Drop 5 lines of YAML into `.github/workflows/api-drift.yml` of any web repository. Automatically reverse-engineers endpoints, checks schema drift, and fails the pull request if a breaking API change is deployed:

```yaml
name: API Contract Drift Gate
on: [push, pull_request]
jobs:
  contract-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jetsontech/SarembokVE@v3.0.0
        with:
          target: 'https://staging.yourdomain.com'
          fail_on_drift: 'true'
```
*Zero dependencies, no local installation, and 0 maintenance overhead for frontend/fullstack teams.*

### Tier 2: Standalone CLI & Zero-Trust Wrapper (`npx sarembok`)
Use Sarembok as an isolated local security supervisor (`openshell`) or instant contract synthesizer (`spec`) without spinning up background daemons, Python kernels, or voice engines:

```bash
# 1. Synthesize OpenAPI 3.1 & TypeScript contracts from any live URL in 5 seconds
npx sarembok spec https://httpbin.org --out api.json

# 2. Dry-run verify an OS command against deny-by-default zero-trust policies
npx sarembok openshell verify "npm test"
npx sarembok openshell verify "rm -rf /"        # ✕ Instantly blocked by mathematical pattern

# 3. Execute an isolated command with Secret Zero credential masking
npx sarembok openshell run "curl -H 'Authorization: Bearer {{SECRET:GITHUB_TOKEN}}' https://api.github.com/user"
```

### Tier 3: Full Sovereign Mesh & Enterprise Runtime
Scale into a fully autonomous, distributed multi-agent swarm when you require state persistence, consensus, and formal verification:

```bash
# Verify local sandbox and live cluster status in under 3 seconds
npm run quickstart

# Start distributed Raft consensus and state engine
node bin/sarembok-cli.js engine start

# Launch high-fidelity real-time digital-human voice fabric (Port 9001)
node bin/sarembok-cli.js engine voice
```

---

## Architecture Mental Model (Standard Equivalencies)

To eliminate custom abstraction overhead, SarembokVE modules map directly to familiar industry standards:

| SarembokVE Subsystem | Familiar Industry Standard | Underlying Pattern / Implementation |
| :--- | :--- | :--- |
| **`Runtime/openshell`** | **Declarative Zero-Trust Supervisor** | Similar to **Open Policy Agent (OPA) / Docker Seccomp** profiles. Deny-by-default execution boundary with Secret Zero injection outside the child process. |
| **`Tools/contract` & `bin/`** | **Playwright + OpenAPI 3.1 AST Generator** | Automated contract synthesizer and breaking-drift gate. Compares route fingerprints against committed baseline JSON schemas. |
| **`fabric/` Micro-Kernel** | **Distributed Raft Consensus & Memory** | Multi-node consensus with log replication, **SQLite-WAL** event-sourced ledger, and state rollback projector. |
| **`fabric/guardrails`** | **Formal Verification & Capability Tokens** | Z3-style constraint evaluation and cryptographic token delegation (Macaroons pattern) for agent permissions. |
| **`fabric/protocols`** | **Model Context Protocol (MCP) Server** | Standard Anthropic MCP v1.0.0 JSON-RPC 2.0 interface for interoperability with external IDEs and agents. |
| **`Deployment/cloud/server.py`** | **OpenAI-Compatible Proxy & Router** | Multi-model fallback circuit breaker (Anthropic Claude, OpenAI GPT-4, Google Gemini, Local Qwen) with semantic caching. |
| **`labs/unreal`** *(Optional)* | **Embodiment Extension Plugin** | Self-contained Unreal Engine 5.x digital-human bridge (completely isolated from the core Node.js CLI lifecycle). |

---

## Quickstart in 10 Seconds

Verify local zero-trust policies and cluster status with zero configuration and zero external services:

```bash
# Clone the repository
git clone https://github.com/jetsontech/SarembokVE && cd SarembokVE

# Fast zero-dependency verification gate
npm run quickstart
```

Sample output:
```text
🛡️  NVIDIA OpenShell Security Control Plane Status
  Engine:               NVIDIA OpenShell Safety Runtime v1.0
  Active Profile:       strict
  Read-Only Root:       ✔ Enforced
  Secret Zero Tokens:   3 credentials masked
  Pending HITL Gates:   0 actions awaiting approval
  Deny Command Rules:   13 mathematical signatures
  Allowed Domains:      github.com, api.github.com, sarembok.com, localhost

=======================================================
   SAREMBOK VE · AUTONOMOUS SYSTEMS VERIFICATION
=======================================================
✔ Sarembok Cluster Online: https://sarembok.com
  Available Scopes: 87 methods enabled
```

---

## Unified CLI Command Reference (`sarembok`)

The unified CLI provides instant access to all runtime scopes:

### 1. NVIDIA OpenShell Zero-Trust Security Commands
```bash
# Inspect containment profile and security posture
node bin/sarembok-cli.js openshell status

# View or switch containment profiles (strict, enterprise, audit, developer)
node bin/sarembok-cli.js openshell profile strict

# Dry-run policy check against deny-patterns and HITL rules
node bin/sarembok-cli.js openshell verify "npm test"

# Run command inside supervised sandbox with Secret Zero token injection
node bin/sarembok-cli.js openshell run "node -v"
```

### 2. Human-In-The-Loop (HITL) Governance
```bash
# List all pending high-risk mutations awaiting operator approval
node bin/sarembok-cli.js pending

# Authorize or reject pending requests
node bin/sarembok-cli.js approve hitl-xxxx
node bin/sarembok-cli.js reject hitl-xxxx "Unapproved mutation"
```

### 3. Contract Drift Gating & API Synthesis
```bash
# Extract OpenAPI 3.1 & TypeScript contracts from a live web application
node bin/sarembok-cli.js spec https://httpbin.org --out api.openapi.json --format openapi

# Run CI/CD drift gate (first run sets baseline, subsequent runs diff against it)
node bin/sarembok-cli.js audit https://httpbin.org
node bin/sarembok-cli.js audit https://httpbin.org --update-baseline

# Export tamper-proof audit trails (SOC 2 / ISO 27001)
node bin/sarembok-cli.js audit export --format json --out ./audit_log.json
```

### 4. Engine & Substrate Management
```bash
# Start backend Python sovereign kernel and state ledgers
node bin/sarembok-cli.js engine start

# Start real-time digital-human WebSocket voice fabric (Port 9001)
node bin/sarembok-cli.js engine voice

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

## Security Containment Profiles

Configured via `Config/openshell.policy.yaml` and `Config/openshell.profiles.json`:

| Profile | Target Environment | Filesystem | Network Egress | HITL Required Actions | Secret Zero |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`strict`** (default) | Production / Banking | Read-only root | Whitelist only | All DB writes, financial, cloud destroy | Enforced |
| **`enterprise`** | Corporate Infrastructure | Read-only root | Whitelist + Intranet | Production DB, cloud destroy | Enforced |
| **`audit`** | Playwright Web Crawler | Read-only root | HTTP/HTTPS only | None (automated extraction) | Enforced |
| **`developer`** | Local Workstation | Read-write | Unrestricted | Financial transactions only | Optional |

---

## Test Suite & Verification

All automated tests pass cleanly with 0 external background daemons required:

```bash
# Fast Node.js test suite (26 passing tests)
npm test

# Fast alias
npm run test:fast
```

Test coverage includes:
- **Contract Diffing & Drift Gating**: 6 tests verifying breaking vs additive changes and schema synthesis.
- **Shannon Entropy Evaluator & Voice Fabric**: 4 tests verifying loop defense and vector rollback SVG generation.
- **NVIDIA OpenShell Supervisor & HITL**: 4 tests verifying deny-patterns, profile switching, and credential masking.
- **Distributed Fabric & Memory Subsystem**: Raft leader election, WAL replay, capability tokens, and state machine projection.
- **Cognitive Router & Visualizer**: Multi-provider circuit breakers, semantic caching, and tamper-proof HTML audit reports.

---

## License

Apache-2.0. See [LICENSE](LICENSE).
