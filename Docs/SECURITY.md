# Sarembok VE // Enterprise Security Architecture Guide
## NVIDIA OpenShell Zero-Trust Integration & Agent Isolation Boundary

SarembokVE pairs an autonomous multi-agent execution kernel with **NVIDIA OpenShell's Zero-Trust reference architecture**. The supervisor operates strictly outside the agent process boundary, ensuring autonomous AI workloads cannot exfiltrate credentials, modify unauthorized systems, or execute runaway tasks.

---

## 1. NVIDIA OpenShell Zero-Trust Supervisor Control Plane

* **Outside-Process Supervision**: Agent processes (Python workers, Playwright crawlers, LLM tool executors) are treated as untrusted entities. Every filesystem operation, shell invocation, and outbound network request is intercepted by the supervisor before OS dispatch.
* **Deny-by-Default Policy**: Configured declaratively via `Config/openshell.policy.yaml`. Any action not explicitly whitelisted is dropped with an immediate `OpenShellPolicyViolationError`.
* **Immutable Security Audit Log**: All security events (`ALLOW`, `DENY`, `HITL_PAUSE`) are logged in real time with cryptographic timestamps into the `security_audit_events` table inside `sarembok_memory.db` (SQLite-WAL).

---

## 2. Secret Zero Credential Injection

* **Zero-Exposure Policy**: Target API keys, cloud tokens, database passwords, and private SSH keys are **strictly forbidden from entering the LLM context layer or agent memory**.
* **Placeholder Tokens**: Agents formulate tool requests using non-sensitive placeholders:
  ```
  {{SECRET:GITHUB_TOKEN}}
  {{SECRET:STRIPE_SECRET_KEY}}
  $SECRET_DATABASE_URL
  ```
* **Boundary Substitution**: The `SecretZeroGateway` intercepts outbound HTTP headers and CLI arguments, dynamically substituting real secrets immediately prior to execution at the edge.
* **Bidirectional Output Sanitization**: All stdout, stderr, exception messages, and response payloads are inspected. Any exposed credential values are redacted (`[SECRET_REDACTED_BY_OPENSHELL]:KEY_NAME`) before being passed back to the agent.

---

## 3. Human-In-The-Loop (HITL) Governance

Programmatic security triggers pause autonomous execution when high-risk operations are attempted:
* **Trigger Conditions**:
  * Production database modifications (`DROP`, `TRUNCATE`, `ALTER`, non-WHERE `DELETE`)
  * Financial transactions or payment provider hooks (`stripe`, `charge`, `transfer`)
  * Cloud infrastructure teardowns (`gcloud projects delete`, `terraform destroy`)
  * Privileged identity operations
* **Resolution Workflow**:
  1. Action paused; request assigned an immutable ID (e.g. `hitl-f503219a`) and persisted to the SQLite-WAL ledger.
  2. Notifications broadcast to operators.
  3. Action unlocked only upon explicit authorization:
     ```bash
     sarembok approve hitl-xxxx
     sarembok reject hitl-xxxx "Policy violation"
     ```

---

## 4. Pre-Baked Containment Profiles

Configured via `Config/openshell.profiles.json`:

| Dimension | `strict` (Default) | `enterprise` | `audit` | `developer` |
| :--- | :--- | :--- | :--- | :--- |
| **Filesystem Root** | Read-Only | Read-Only | Read-Only | Read-Write |
| **Protected Paths** | `~/.ssh`, `~/.aws`, `.env`, `id_rsa*`, `System32` | `~/.ssh`, `~/.aws`, `.env` | All except `/tmp` & `./public` | `~/.ssh`, `.env` |
| **Network Egress** | Whitelist domains only | Whitelist + Intranet | Unrestricted HTTP/S | Unrestricted |
| **Port Filtering** | Blocks 22, 25, 3389, 445, 135 | Blocks 22, 25, 3389 | Blocks 22, 25, 3389, 445 | None |
| **Memory Limit** | 768 MB | 1536 MB | 768 MB | 4096 MB |
| **HITL Triggers** | All DB writes, financial, cloud destroy | DB write, financial, cloud destroy | None (read-only crawler) | Financial only |
| **Secret Zero** | Enabled | Enabled | Enabled | Optional |

---

## 5. Shannon Entropy Loop Defense ($H(X) \ge 0.88$)

* Autonomous agents can get trapped in recursive hallucination loops, draining tokens and creating runaway processes.
* The `ShannonEntropyEvaluator` calculates Shannon entropy $H(X) = -\sum p_i \log_2(p_i)$ across a sliding window of cognitive states.
* If entropy collapses below the safety threshold ($1 - 0.88 = 0.12$), the kernel immediately executes an automated rollback to the last verified checkpoint and synthesizes an executive halt vector SVG map (`public/generated/visuals/halt_trace_map.svg`).

---

## 6. Audit Trail Export & SOC 2 Compliance

Enterprise risk teams can export complete, tamper-proof logs with a cryptographic SHA-256 seal:
```bash
node bin/sarembok-cli.js audit export --format json --out ./audit_log.json
node bin/sarembok-cli.js audit export --format csv --out ./audit_log.csv
```
