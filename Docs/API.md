# Sarembok VE API Specification

## JSON-RPC 2.0 Protocol Standard

All RPC requests follow the standard JSON-RPC 2.0 envelope format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "Health",
  "params": {
    "authToken": "<YOUR_SAREMBOK_AUTH_TOKEN>"
  }
}
```

---

## Endpoint Reference

### System & Control Plane
* `Health`: System liveness check and summary metrics.
* `RuntimeInfo`: Process uptime, worker count, active session counters, storage status.
* `GetMetrics`: System reliability and cognitive score metrics.

### Worker Management
* `RegisterWorker`: Register a new GPU worker node with capabilities, GPU model, VRAM, and latency.
* `ListWorkers`: Query registered workers with optional capability/status filtering.
* `Heartbeat`: Refresh worker heartbeat timestamp and status (`ONLINE`, `BUSY`, `OFFLINE`).

### Autonomous Agents
* `CreateAgent`: Provision a new agent identity.
* `ListAgents`: List registered agents.
* `GetAgent`: Query agent details.
* `QueryAgentState`: Check agent cognitive lifecycle stage.
* `GetCognitiveScorecard`: Retrieve cognitive breakdown (perception, memory, reasoning, governance).

### Task & Compute Scheduler
* `ScheduleCompute`: Schedule a compute task on an available GPU worker.
* `CreateTask`: Create a custom task in the scheduler queue.
* `ListTasks`: Retrieve task queue with status filtering.
* `GetTask`: Fetch specific task status.
* `CancelTask`: Cancel an active or queued task.

### Digital Humans
* `CreateDigitalHumanSession`: Initialize an in-engine MetaHuman session.
* `ListDigitalHumanSessions`: Query active/past sessions.
* `GetDigitalHumanSession`: Retrieve specific session state.

### Messaging & Events
* `SendMessage`: Send message payload to an agent.
* `InjectPerception`: Inject perception data into agent loop.
* `EvaluateDecision`: Run decision through governance policy check.
* `GetEvents` / `ListEvents`: Query append-only audit trail with filtering.
* `GetAuditTrail`: Verify audit trail record count and integrity.
* `CreateDelegation`: Create sub-goal delegation between agents.
* `RestoreState`: Replay SQLite WAL entries to restore state.

### Multi-Sector Intelligence & Telemetry (v0.3.0)
* `sarembok.dispatch_directive`: High-entropy natural language directive dispatch with automated intent classification.
  - Multi-sector parallel fan-out across 15 standard industry sectors (Technology, Energy, Healthcare, Financials, Defense, Industrials, etc.).
  - Real-time batch asset quote fetching with sub-second parallel HTTP execution.
  - Domain-targeted RSS news ingestion and multi-perspective contextualization.
  - Argon visual vector synthesis: Generates responsive SVG technical overlays, performance sparklines, and visual execution cards directly in the streaming HUD.
* `GetSectorTaxonomy`: Returns the dictionary of supported GICS sectors, benchmark ETF symbols, and search keyword mappings.
* `FetchAssetQuotesBatch`: Concurrent retrieval of real-time quotes, 24h percentage movements, price ranges, and volume metrics for arbitrary ticker arrays.

---

### NVIDIA OpenShell & Security Control Plane (v0.3.0)
* `OpenShell.ValidateAction`: Validates a proposed command, filesystem path, or network egress against the active deny-by-default profile.
* `OpenShell.GetStatus`: Returns active containment profile, memory limits, read-only root status, and registered Secret Zero token count.
* `OpenShell.SetProfile`: Switches active profile between `strict`, `enterprise`, `audit`, and `developer`.
* `HITL.RequestApproval`: Creates an immutable authorization request in SQLite-WAL for sensitive operations (DB mutations, financial, cloud destroy).
* `HITL.Approve`: Authorizes a pending request by ID.
* `HITL.Reject`: Permanently rejects a pending request with logged reason.
* `HITL.ListPending`: Retrieves all actions currently awaiting operator sign-off.
* `SecretZero.Inject`: External credential injection substituting `{{SECRET:KEY}}` outside LLM context.
* `SecretZero.Sanitize`: Bidirectional redaction scrubbing secrets from responses and error traces.

---

### Cognitive Resilience & Semantic Optimization (v0.3.0)
* `SemanticCache.Get`: Retrieves cached intermediate reasoning step by prompt/task signature (up to 40% token cost reduction).
* `SemanticCache.Set`: Stores completed reasoning artifact with token savings tracking.
* `SemanticCache.GetStats`: Returns cache hit rate, total tokens saved, and estimated cost reduction in USD.
* `ModelRouter.Execute`: Tri-tier model execution with automatic circuit breaker (Frontier $\to$ Secondary $\to$ Local Sovereign).
* `Entropy.Evaluate`: Computes Shannon entropy across sliding state window ($H(X) \ge 0.88$ rollback threshold).
* `Audit.Export`: Exports compliant, tamper-proof audit trails (JSON or CSV) with SHA-256 Merkle seal.
