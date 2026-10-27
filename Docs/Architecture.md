# Sarembok VE Architecture Guide
## Modular Multi-Agent Kernel & NVIDIA OpenShell Security Architecture

Sarembok VE is an AI-native computing environment, zero-trust execution fabric, and automated contract governance platform developed and architected by the SarembokVE team, led by **Tim Hall**, its Founder and AI Systems Architect. Tim founded SarembokVE and leads its overall technical vision, systems architecture, and development direction.

Architecture Decision Records (ADRs) are documented in [Docs/ADR.md](ADR.md).

---

## 3-Tier Progressive Adoption Model

To eliminate architectural overkill and high complexity overhead, Sarembok VE is partitioned into three progressive adoption tiers:

1. **Tier 1: Drop-In CI/CD Action (`action.yml`)**: Zero-install OpenAPI 3.1 & TypeScript AST contract drift gating for standard web apps in 30 seconds.
2. **Tier 2: Standalone Zero-Trust CLI (`npx sarembok`)**: Supervised local command containment with declarative deny-by-default rules and Secret Zero token masking.
3. **Tier 3: Distributed Multi-Agent Sovereign Mesh (`fabric/`)**: Multi-agent consensus, SQLite-WAL event-sourced state machines, and formal verification.

---

## Seven Architectural Subsystems

Sarembok VE is structured across seven interconnected layers:

1. **Edge Transport Layer (Caddy)**: Public HTTPS and WSS entry point providing automated TLS termination, security header injection, and reverse proxying.
2. **Web Operator Layer (Frontend)**: Single-page web application serving a public landing showcase and an authenticated operator control plane for real-time monitoring and management.
3. **NVIDIA OpenShell Zero-Trust Security Control Plane**: Sits outside the agent execution process:
   - **Declarative Policy Engine**: Enforces deny-by-default rules on filesystem, network egress, and shell commands.
   - **Secret Zero Gateway**: Intercepts outbound requests and injects actual credentials at the edge while scrubbing them from returned responses and error logs.
   - **Human-In-The-Loop (HITL) Gate**: Programmatic threshold interception pausing destructive or high-risk tasks until operator approval.
4. **Cloud Runtime Core (`sarembok-runtime`)**: Asynchronous Python & Node.js substrate handling SQLite-WAL persistence, JSON-RPC 2.0 dispatch, GPU compute scheduling, and digital human session routing.
   - **Multi-Sector Real-Time Parallel Fan-Out Engine**: ThreadPool concurrent dispatch that splits cross-sector queries into parallel workers across 15+ standard industry sectors with sub-second latency.
   - **Argon Telemetry Substrate**: High-contrast, mathematically precise SVG vector graphics synthesis engine providing visual execution cards, live candlestick/sparkline rendering, and topology graphs.
5. **Cognitive Core, Memory & Resilience**:
   - **Shannon Entropy Loop Defense ($H(X) \ge 0.88$)**: Real-time sliding-window entropy evaluator that halts recursive hallucination loops and triggers automated state rollbacks.
   - **Semantic Reasoning Cache**: Aggressive caching layer for intermediate reasoning steps and prompt embeddings, reducing LLM token costs by up to 40%.
   - **Model Fallback Circuit Breaker**: Dynamic tri-tier routing across primary frontier models, secondary fast models, and sovereign local models (Ollama/Llama 3.2).
6. **Neural Pod Services**:
   - **Voice Pod (`sarembok-voice`)**: Kokoro-82M neural TTS model serving low-latency speech synthesis over internal HTTP.
   - **Browser Pod (`sarembok-browser`)**: Playwright headless Chromium container executing web crawlers, DOM inspection, and automated API specification extraction in capability-dropped sandboxes.
7. **Engine Client Layer (Unreal Engine 5.8 Labs Extension)**: Self-contained optional digital-human presence plugins (`labs/unreal`) executing real-time morph targets, speech, perception, and reasoning loops (isolated from the core CLI and CI/CD tools).

---

## Architectural Data Flow Diagram

```text
User / Operator / CI-CD Pipeline
      │
      ├─── HTTP GET / ────────► Caddy Edge ───► Static Web App (index.html, docs, status)
      │
      └─── WSS /ws / CLI ─────► NVIDIA OpenShell Zero-Trust Supervisor
                                      │ (Deny-by-default policy, Secret Zero, HITL gate)
                                      ▼
                                sarembok-runtime
                                      │
                                      ├──► Semantic Reasoning Cache (40% token cut)
                                      │
                                      ├──► Model Fallback Router (Frontier -> Secondary -> Local)
                                      │
                                      ├──► Multi-Sector Parallel Fan-Out (ThreadPool)
                                      │     ├── Financial Chart Telemetry (XLK, XLE, etc.)
                                      │     └── Domain Feeds & News RSS
                                      │
                                      ├──► Shannon Entropy Evaluator (H >= 0.88 rollback)
                                      │     └── Argon Visualizer (SVG vector maps)
                                      │
                                      ├──► Ephemeral Browser Sandbox (sarembok-browser :9100)
                                      │     └── OpenAPI 3.1 & TypeScript Synthesizer
                                      │
                                      ├──► Neural Voice Pod (sarembok-voice :8880)
                                      │
                                      ├──► SQLite-WAL Ledger (sarembok_memory.db)
                                      │     ├── cognitive_traces & security_audit_events
                                      │     └── hitl_approvals
                                      │
                                      └──► Digital Human Sessions (Unreal Engine 5.8)
```

---

## Storage & Ledger Architecture

All persistent runtime memory is stored in zero-locking SQLite-WAL format (`sarembok_memory.db`):

- `cognitive_traces`: Real-time state hashes, prompt tokens, and evaluated Shannon entropy scores.
- `security_audit_events`: Immutable audit trail of every intercepted command, network egress, and filesystem access.
- `hitl_approvals`: Pending, approved, or rejected operator authorization requests with Merkle integrity hashes.
- `semantic_cache`: Deterministic prompt signatures, cached reasoning completions, and token savings metrics.
- `model_fallback_events`: Circuit breaker trip history and model failover routes.
