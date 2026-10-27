# Sarembok VE Architecture Guide
## Modular Multi-Agent Kernel & NVIDIA OpenShell Security Architecture

Sarembok VE is designed as a modular, hardware-adaptive AI-native computing platform consisting of seven interconnected architectural layers:

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
7. **Engine Client Layer (Unreal Engine 5.8)**: In-engine C++ subsystem plugins (`SarembokBridge`, `SarembokAvatar`, `SarembokVoice`, `SarembokVision`, `SarembokAgent`, `SarembokMemory`) executing real-time morph targets, speech, perception, and reasoning loops.

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
