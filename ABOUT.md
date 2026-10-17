# About SarembokVE

### Autonomous Systems Verification Engine & Sovereign Compute Mesh
**Jetson Technologies · Enterprise AI Infrastructure**

**Live Platform:** [https://sarembok.com](https://sarembok.com)  
**Interactive Console:** [https://sarembok.com/console](https://sarembok.com/console)  
**Projects & Walkthroughs:** [https://sarembok.com/projects](https://sarembok.com/projects)  
**Technical Documentation:** [https://sarembok.com/docs](https://sarembok.com/docs)  

---

## 1. Mission & Philosophy

Modern software engineering suffers from an acute documentation and verification deficit. APIs drift, undocumented internal portals change without warning, and engineering teams waste countless hours manually reverse-engineering network requests and writing brittle interface contracts. At the same time, proprietary cloud LLM APIs charge steep token tolls for basic reasoning workflows.

**SarembokVE** is built on a single, uncompromising principle:  
> **Build the thing, prove it with code and live telemetry, then describe it.**

We reject mockups, synthetic marketing hype, and unverified benchmarks. Every feature in SarembokVE is operational, tested against real targets, and verifiable live in production.

---

## 2. Core Pillars of the Platform

### I. Autonomous Web Reverse-Engineering & Specification Induction
Given any public web application, undocumented API, or enterprise portal, SarembokVE spawns an ephemeral headless Playwright Chromium instance inside an isolated container (`cap_drop: ALL`, 768MB RAM ceiling). It intercepts raw HTTP network traffic, analyzes DOM mutations, detects data structures, and automatically generates:
* **Authoritative OpenAPI 3.1.0 specifications** compliant with JSON Schema Draft 2020-12.
* **Strict TypeScript interface definitions** (`.d.ts`) ready for enterprise codebases.
* **Instant downloads and live cURL integrations** with sub-3-second verification latency.

### II. Sovereign GPU Compute Mesh
Why pay proprietary cloud token APIs when commodity and distributed GPUs can serve reasoning models at zero marginal cost?
* **Decentralized Compute Worker Protocol:** Workers connect to the central cluster edge (`wss://sarembok.com/worker/ws`) using secure cryptographic enrollment tokens.
* **Supported Sovereign Models:** `muse-glimmer-30b` and `qwen-2.5-coder-32b`.
* **1-Click Google Colab & RunPod Nodes:** Launch free T4/A100 GPU compute nodes with zero local installation using our official [Colab Notebook](https://github.com/jetsontech/SarembokVE/blob/main/Deployment/cloud/sarembok_gpu_worker.ipynb).

### III. 1-Command Zero-Install Developer CLI & CI/CD Gates
* **Developer CLI (`npx sarembok`):** Run audits, extract specifications, and verify cluster health directly from any developer terminal:
  ```bash
  # Check cluster connectivity
  npx sarembok health

  # Reverse-engineer any endpoint to OpenAPI 3.1 & TypeScript
  npx sarembok spec https://httpbin.org

  # Run as a CI/CD build gate (fails build if contract regressions occur)
  npx sarembok audit https://httpbin.org

  # Join machine to the sovereign GPU compute mesh
  npx sarembok worker
  ```
* **Official GitHub Action (`action.yml`):** Gate merge requests on contract drift with a single workflow step.

### IV. Persistent SQLite-WAL Memory Architecture
Unlike stateless chatbots that lose context upon browser refresh, SarembokVE maintains an event-sourced SQLite-WAL persistence layer across 4 distinct memory tiers:
* `SEMANTIC`: Domain knowledge and persistent facts.
* `WORKING`: Active session context and multi-turn goals.
* `SPATIAL`: System environment and network topologies.
* `CORE`: Immutable user directives and security policies.

Every recall is annotated in the response with exact timestamps and keys, showing the user precisely which memory events informed the agent's reasoning.

### V. ARKit 52-Blendshape MetaHuman Holographic HUD
An interactive WebGL 3D face topology rendering pipeline running directly in the browser console. Tracks 52 ARKit blendshapes (`jawOpen`, `mouthSmile`, `eyeBlink`, `browInnerUp`) in real time, reacting to cursor movement and live audio streaming.

---

## 3. Production Infrastructure & Security Boundaries

* **Edge Gateway:** Caddy 2 reverse proxy with automatic Let's Encrypt TLS 1.3, strict origin verification, and HSTS.
* **Container Isolation:** Internal runtime port 9000 is isolated from public host interfaces.
* **Zero Data Retention for Training:** SarembokVE does not sell user queries or crawled schemas, and never trains public AI models on customer conversations.
* **Instant Data Purge:** Users can purge all session records and memory graphs at any moment via `/clear`.

---

## 4. Contact & Links

* **Company:** Jetson Technologies
* **Repository:** [https://github.com/jetsontech/SarembokVE](https://github.com/jetsontech/SarembokVE)
* **Production Gateway:** [https://sarembok.com](https://sarembok.com)
* **License:** Apache-2.0
