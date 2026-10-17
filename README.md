# SarembokVE

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Platform: Live](https://img.shields.io/badge/Production-sarembok.com-emerald.svg)](https://sarembok.com)
[![Engine: Playwright Chromium](https://img.shields.io/badge/Engine-Playwright%20Chromium-38bdf8.svg)](https://sarembok.com/projects)
[![CLI: npx sarembok](https://img.shields.io/badge/CLI-npx%20sarembok-f59e0b.svg)](https://sarembok.com/docs#cli)
[![Compute: Sovereign Mesh](https://img.shields.io/badge/Mesh-Muse--Glimmer--30B-a855f7.svg)](https://github.com/jetsontech/SarembokVE/blob/main/Deployment/cloud/sarembok_gpu_worker.ipynb)

**Autonomous Systems Verification Engine & Sovereign Compute Mesh**  
Reverse-engineer web apps to OpenAPI 3.1 & TypeScript contracts with Playwright Chromium, run zero-cost GPU inference, and gate CI/CD pipelines.

👉 **[Try the Live Console →](https://sarembok.com)** · **[Live Playground →](https://sarembok.com/projects)** · **[Documentation & CLI →](https://sarembok.com/docs)** · **[About →](ABOUT.md)**

---

## What It Does Today

SarembokVE is an enterprise-grade platform combining three breakthrough capabilities into a unified operational environment:

1. **Autonomous Web Reverse-Engineering & Specification Induction:** Give SarembokVE any public URL. An ephemeral headless Playwright Chromium container navigates the site, captures live HTTP traffic and DOM mutations, and automatically synthesizes authoritative **OpenAPI 3.1.0** specifications and **TypeScript** (`.d.ts`) contract interfaces in sub-3-second verification passes.
2. **Sovereign GPU Compute Mesh:** Run decentralized inference workloads on free Google Colab (T4) or RunPod (A100) GPU nodes serving `muse-glimmer-30b` and `qwen-2.5-coder-32b` over encrypted reverse WebSocket tunnels, eliminating recurring cloud API token costs.
3. **Persistent SQLite-WAL Memory & Recall Verification:** Unlike stateless chatbots, SarembokVE stores facts in a tiered SQLite-WAL persistence layer (`SEMANTIC`, `WORKING`, `SPATIAL`, `CORE`). When the agent answers, it displays exact cryptographic recall tags proving which stored memories informed its response.

---

## Quick Start (Zero Install)

### 1-Command Developer CLI

You can run SarembokVE directly from your terminal using `npx`:

```bash
# Check cluster connectivity and active scopes
npx sarembok health

# Reverse-engineer any endpoint to OpenAPI 3.1 & TypeScript
npx sarembok spec https://httpbin.org

# Run as a CI/CD build gate (fails build on contract regressions)
npx sarembok audit https://httpbin.org

# Connect your local machine/GPU to the sovereign compute mesh
npx sarembok worker
```

### GitHub Actions CI/CD Gate

Add automated contract regression auditing to your repository's CI/CD pipeline using the official action:

```yaml
name: API Contract Drift Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Sarembok Autonomous API Gate
        uses: jetsontech/SarembokVE@main
        with:
          target-url: 'https://staging.api.example.com'
```

---

## Interactive Multi-View Console

![SarembokVE Mission Control Console](Docs/console.png)

Open **[sarembok.com](https://sarembok.com)** to access the unified mission control interface:

* **⚡ Engine Workspace:** Live terminal supporting `/spec <url>`, memory inspection, and real-time streaming.
* **🌐 Compute Mesh Dashboard:** Real-time decentralized GPU cluster topology, active WebSocket worker pools, and 1-click Colab node launcher.
* **🚀 Live Playground:** Interactive Playwright Chromium sandbox where visitors can input any target URL and immediately download OpenAPI JSON and TypeScript contracts.
* **📖 Docs & CLI:** cURL code generators, JSON-RPC schemas, and CI/CD integration recipes.
* **👤 Hologram HUD:** WebGL 3D MetaHuman ARKit face topology visualizer tracking 52 blendshapes (`jawOpen`, `mouthSmile`, `eyeBlink`, `browInnerUp`) in real time.
* **🔒 Privacy & ⚖ Terms:** Institutional privacy guarantees and zero training data retention policies.

---

## Architecture

```text
Browser / Developer CLI / CI Runner
       │
       ▼ (TLS 1.3 / WebSocket / REST)
 ┌─────────────────────────────────────────────────────────┐
 │               Caddy 2 Edge Reverse Proxy                │
 │         (Rate Limiting, HSTS, Strict Origin Auth)       │
 └────────────────────────────┬────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
 ┌───────────────────────────┐ ┌───────────────────────────┐
 │  Sarembok Runtime Core    │ │ Ephemeral Browser Pod     │
 │  (Python 3.12 / asyncio)  │ │ (Playwright Chromium)     │
 │  • 80+ JSON-RPC Methods   │ │ • Live Network Sniffing   │
 │  • SQLite-WAL Persistence │ │ • Schema Induction Engine │
 │  • Provider Routing       │ │ • OpenAPI 3.1 Synthesis   │
 └─────────────┬─────────────┘ └───────────────────────────┘
               │
               ▼ (WSS Encrypted Reverse Tunnel)
 ┌─────────────────────────────────────────────────────────┐
 │               Sovereign GPU Compute Mesh                │
 │   • Google Colab (Tesla T4) / RunPod (NVIDIA A100)      │
 │   • Models: Muse-Glimmer-30B, Qwen-2.5-Coder-32B        │
 │   • Concrete WorkerTaskExecutor with vLLM / PyTorch     │
 └─────────────────────────────────────────────────────────┘
```

---

## Real Capabilities vs. Truth Boundaries

We hold ourselves to a strict standard of truth in engineering:

| Component | Status | Implementation Evidence |
|-----------|--------|-------------------------|
| **Headless Spec Synthesis** | ✅ Verified Production | Playwright Chromium crawling, JSON Schema 2020-12 induction, sub-3s latency. |
| **Developer CLI (`npx sarembok`)** | ✅ Verified Production | Standalone zero-dependency executable (`bin/sarembok.js`). |
| **CI/CD GitHub Action** | ✅ Verified Production | Native composite action (`action.yml`). |
| **Sovereign GPU Mesh** | ✅ Verified Production | `colab_worker.py` with concrete `WorkerTaskExecutor` + official Colab Notebook. |
| **Sovereign Models** | ✅ Verified Production | Direct execution routing for `muse-glimmer-30b` and `qwen-2.5-coder-32b`. |
| **SQLite-WAL Memory** | ✅ Verified Production | Event-sourced SQLite tables with cryptographic recall annotations. |
| **ARKit 3D Hologram** | ✅ Verified Production | 52-blendshape WebGL canvas built into the console. |
| **Edge Security** | ✅ Verified Production | Caddy 2 reverse proxy, TLS 1.3, internal container isolation on port 9000. |

---

## Local Development & Self-Hosting

### With Docker Compose

```bash
git clone https://github.com/jetsontech/SarembokVE.git
cd SarembokVE

# Configure environment keys (optional, fallback to local/openrouter)
export GEMINI_API_KEY="your-key"

# Deploy cluster
cd Deployment/cloud
docker compose -f compose.production.yaml up -d --build
```

### Run Tests & Security Gates

```bash
# Run pytest verification suite (25/25 tests)
python -m pytest Deployment/cloud/test_frontend_rendering.py \
                 Deployment/cloud/test_specification_engine.py \
                 Deployment/cloud/test_truth_boundaries.py \
                 Deployment/cloud/test_frontier_controls.py -v

# Run static release gate
python Deployment/cloud/frontier_release_gate.py
```

---

## License

Distributed under the Apache 2.0 License. See `LICENSE` for more information.

---

**SarembokVE** · [sarembok.com](https://sarembok.com) · [Jetson Technologies](https://github.com/jetsontech)
