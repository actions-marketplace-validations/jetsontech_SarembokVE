# SarembokVE Architecture Decision Records (ADR)

This document records the key architectural decisions that govern the SarembokVE runtime, decoupling core developer tooling from heavy extensions, and standardizing interfaces against familiar industry models.

---

## ADR-001: 3-Tier Progressive Adoption Architecture

### Context
Previously, SarembokVE was perceived as an "all-or-nothing" operating system that required a monolithic setup (Python sovereign kernel, Unreal Engine plugins, voice fabrics, GPU workers, and Node supervisors). This created a high barrier to entry for standard web apps and backend services that merely needed lightweight contract gating or isolated security auditing.

### Decision
Decouple SarembokVE into three independent, progressive tiers:
1. **Tier 1: Drop-In CI/CD GitHub Action (`action.yml`)**: Zero local installation. Standard web applications drop 4 lines of YAML into `.github/workflows` to automate OpenAPI 3.1 contract synthesis and gate breaking API changes.
2. **Tier 2: Standalone CLI & Zero-Trust Supervisor (`npx sarembok`)**: A standalone developer utility providing declarative command sandboxing (`openshell run`), policy auditing (`policy verify`), and contract diffing (`sarembok spec <url>`) with zero background daemons.
3. **Tier 3: Distributed Sovereign Fabric (`fabric/`)**: The complete distributed micro-kernel featuring Raft consensus, SQLite-WAL state machine, symbolic formal verification, Model Context Protocol (MCP) server, and eBPF network tracing for multi-agent swarms.

### Status
Accepted & Implemented in v0.3.0.

### Consequences
- Standard web developers can adopt contract drift gating in under 30 seconds with zero runtime dependencies.
- Developers needing local security wrappers run `npx sarembok openshell run "<cmd>"` without spinning up Python or Docker.
- Advanced enterprise users scale seamlessly into Tier 3 without changing configuration semantics.

---

## ADR-002: Modular Workspace Decoupling (Core vs. Extensions)

### Context
Monorepo root pollution with legacy Windows deployment scripts (`.ps1`, `.bat`) and heavy binary runtime databases (`sarembok_memory.db`) elevated perceived maintenance burden and complicated onboarding.

### Decision
1. **Root Directory Hygiene**: All legacy Windows and automation scripts are consolidated into `Tools/scripts/windows/`. The repository root retains only standard manifests (`package.json`, `action.yml`, `sarembok.config.json`).
2. **Dynamic Database Initialization**: Runtime SQLite databases (`sarembok_memory.db`, `sarembok_runtime.db`, `*.db-wal`, `*.db-shm`) are excluded from version control and initialized dynamically with WAL mode and foreign key integrity on first boot.
3. **Optional Extensions Isolation**: Heavy modules such as Unreal Engine integrations (`labs/unreal`), Python sovereign servers (`server.py`, `Deployment/cloud/`), and voice synthesis pipelines are treated as self-contained plugins that do not obstruct the core Node.js CLI lifecycle.
4. **Standardized Submodule Exports**: Expose standard ECMAScript module export boundaries via `package.json`:
   - `"."`: Unified CLI entrypoint (`./bin/sarembok-cli.js`)
   - `"./openshell"`: Zero-trust supervisor & policy runtime (`./Runtime/openshell/index.js`)
   - `"./fabric"`: Distributed Raft consensus, formal verifier & WAL store (`./fabric/index.js`)
   - `"./contract"`: OpenAPI 3.1 synthesis & diffing engine (`./Tools/contract/index.js`)

### Status
Accepted & Implemented.

---

## ADR-003: Industry Mental Model Equivalency Mapping

### Context
Custom terminology (e.g. "Sovereign Kernel", "OpenShell Supervisor", "Contract Engine", "Entropy Gate") caused high cognitive overhead and delayed developer onboarding.

### Decision
Standardize documentation and developer error messaging against industry-standard equivalencies:

| Sarembok Subsystem | Industry Standard Mental Model | Underlying Standard / Mechanism |
| :--- | :--- | :--- |
| **`Runtime/openshell`** | **Declarative Zero-Trust Policy Engine** | Open Policy Agent (OPA) / Docker Seccomp profile pattern with deny-by-default execution boundaries. |
| **Autonomous Contract Engine** (`Tools/contract`, `bin/`) | **Automated Contract Testing & AST Generator** | Playwright network capture + OpenAPI 3.1 JSONSchema AST generator + semantic drift breaker. |
| **`fabric/` Micro-Kernel** | **Distributed Consensus & State Machine** | Raft consensus algorithm + SQLite-WAL event-sourced distributed state mesh. |
| **`fabric/guardrails`** | **Formal Verification & Capability Security** | Object-capability model (Macaroons / zcap-ld) + Z3-style symbolic constraint solving. |
| **`Deployment/cloud/server.py`** | **OpenAI-Compatible Multi-Model Proxy** | Reverse proxy router with provider fallback and circuit breaking across Anthropic, OpenAI, and Gemini. |
| **`labs/unreal`** | **Embodiment & Visual Protocol Adapter** | Optional gRPC / WebSocket bridge for 3D digital human presence. |

### Status
Accepted & Implemented.

---

## ADR-004: Zero-Config Onboarding Verification Gate

### Context
Developers need immediate assurance that the platform is operational without spending hours configuring cloud keys, GPU drivers, or container daemons.

### Decision
Provide `npm run quickstart` as a single, sub-5-second command that executes:
1. Local NVIDIA OpenShell policy status check (read-only root enforcement, deny-pattern count, Secret Zero credential masking).
2. Live cluster health & schema validation against `https://sarembok.com`.
3. Passes with exit code 0 under standard Node.js (>=20) with zero external daemons required.

### Status
Accepted & Implemented.
