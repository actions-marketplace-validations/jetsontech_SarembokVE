# Changelog

All notable changes to the **SarembokVE** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-10-27

### Added
- **Multi-Node HTTP Raft Transport (`fabric/consensus/raft_consensus.js`)**:
  - Zero-dependency Node.js `node:http` RPC listener (`startRpcServer(port)` / `stopRpcServer()`).
  - Network endpoints:
    - `POST /raft/request-vote`: Evaluates candidate term, log index, persists vote, and returns quorum grant status.
    - `POST /raft/append-entries`: Verifies leader term, validates prevLogIndex/prevLogHash SHA-256 Merkle link, appends entries, verifies log integrity via `verifyIntegrity()`, advances commit index, and returns `{ term, success, matchIndex, lastEntryHash }`.
  - `replicateToPeer(peerUrl, entry)` native fetch/HTTP client method enabling live loopback and distributed peer replication.
- **HMAC-SHA256 Macaroon Capability Enforcement (`Runtime/openshell` & CLI)**:
  - CLI subcommand `sarembok token mint --scope <scope> --path <prefix> --ttl <seconds>` to mint tamper-evident Macaroon tokens with cryptographic signature chains.
  - CLI flag `--token <base64OrJsonMacaroon>` on `sarembok openshell run "<cmd>" --token <token>`.
  - OpenShell sandbox runtime verification of HMAC-SHA256 signatures and caveat evaluation against `{ scope: 'execute', path: process.cwd(), command: cmd }` before spawning jailed processes.
- **Unified v3.0.0 Client SDK (`SDK/`)**:
  - `SDK/index.js` exporting `SarembokClient`, `CapabilityTokenFactory`, and `CapabilityType`.
  - High-level wrappers for Model Context Protocol (MCP) tools: `openshellVerify`, `contractSpec`, `entropyEvaluate`, and `walVerify`.
  - First-class Macaroon token helpers: `mintToken`, `attenuateToken`, and `verifyToken`.
  - Updated TypeScript SDK (`SDK/typescript/sarembok_sdk.ts`) with typed MCP tool signatures.
- **GitHub Marketplace Composite Action (`action.yml`)**:
  - Market-ready metadata with author `Tim Hall (@jetsontech)`, shield branding, and unified input mappings (`target`, `baseline`, `fail_on_drift`, `profile`, `update_baseline`) running against `bin/sarembok-cli.js`.

### Changed
- **Version Alignment**:
  - Synchronized `package.json` to version `3.0.0`.
  - Aligned exports with `./sdk`, `./openshell`, `./fabric`, and `./contract`.
  - Updated `README.md` test badge to reflect 32+ passing cryptographic and contract test suite.

### Security
- Deterministic AST verification and nested Macaroon caveat attenuation prevents unauthorized process execution and privilege escalation in autonomous agent workflows.
- Secret Zero stream redaction continuously masks registered secrets in subprocess stdout/stderr streams.

---

## [0.3.1] - 2026-10-27

### Added
- Model Context Protocol (MCP) live JSON-RPC 2.0 stdio server (`sarembok mcp`).
- Cryptographic Merkle hash chain on SQLite-WAL entries and Raft log.
- Human-In-The-Loop (HITL) approval gates stored in SQLite-WAL.
- NVIDIA OpenShell zero-trust sandbox execution runtime.

---

## [0.3.0] - 2026-10-26

### Added
- Initial 3-tier progressive adoption architecture.
- OpenAPI 3.1 reverse-engineering and contract drift detection engine.
- Drop-in GitHub Action for automated contract gating.
