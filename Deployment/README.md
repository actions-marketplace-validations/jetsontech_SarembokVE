# SarembokVE Deployment Architecture & Systems Guide

## Overview

SarembokVE is deployed across a hybrid topology consisting of local operator workstations, edge reverse proxies, cloud-native containerized runtimes, and distributed GPU worker nodes.

The production cluster is deployed live at **[https://sarembok.com](https://sarembok.com)** on an OVH dedicated VPS (`15.204.173.205`).

---

## Production Stack Architecture

The production environment runs via Docker Compose with the following service mesh:

```
                            [ Internet / Clients ]
                                      │
                                      ▼
                      ┌────────────────────────────────┐
                      │    sarembok-edge (Caddy 2)     │
                      │  - Automated Let's Encrypt TLS │
                      │  - Security Header Hardening   │
                      │  - WebSocket /ws Reverse Proxy │
                      └───────────────┬────────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│   sarembok-runtime    │  │    sarembok-voice     │  │   sarembok-browser    │
│  - Python 3.11 / Uvic │  │  - Kokoro-82M TTS Pod │  │  - Headless Chromium  │
│  - Multi-Sector Engine│  │  - FastAudio Endpoint │  │  - Ephemeral Sandbox  │
│  - SQLite-WAL State   │  │  - Port 8880 Internal │  │  - Port 9100 Internal │
│  - Argon Telemetry    │  └───────────────────────┘  └───────────────────────┘
│  - Port 9000 Internal │
└───────────────────────┘
```

### 1. `sarembok-edge` (Caddy)
- Automated TLS certificates for `sarembok.com`.
- Static asset serving for HTML/CSS/JS frontend pages (`/`, `/docs`, `/projects`, `/status`, `/changelog`, `/security`, `/terms`, `/privacy`).
- WebSocket reverse proxying for `/ws` to `sarembok-runtime:9000`.
- API proxying for `/api/session`, `/api/spec`, and `/rpc`.

### 2. `sarembok-runtime` (FastAPI / Uvicorn)
- Control plane and directive dispatch engine (`sarembok.dispatch_directive`).
- **Multi-Sector Real-Time Fan-Out Engine**: Concurrent `ThreadPoolExecutor` query dispatch across 15 standard GICS sectors, Yahoo Finance real-time quotes, and Google News RSS feeds.
- **Argon Telemetry Substrate**: High-contrast SVG vector synthesis for market analysis, technical indicator overlays, and visual execution traces.
- SQLite database backing persistent memory and session state (`/data/sarembok_cloud.db` in WAL mode).

### 3. `sarembok-voice` (Kokoro-82M TTS)
- Low-latency neural speech synthesis pod for real-time auditory execution feedback.

### 4. `sarembok-browser` (Playwright Chromium)
- Sandboxed headless browser container for web crawling, DOM inspection, and automated API reverse-engineering.

---

## One-Command Deployment Pipeline

To deploy updates to the production cluster, execute:

```powershell
powershell -ExecutionPolicy Bypass -File Tools/Deploy-To-OVH.ps1
```

This automated deployment script performs:
1. SSH authentication to the OVH host (`15.204.173.205`).
2. Git fetch and pull against `origin/main`.
3. Image rebuild and container update via `docker compose -f Deployment/cloud/compose.yaml -f Deployment/cloud/compose.production.yaml up -d --build`.
4. Automated container health check and HTTPS smoke tests.

---

## Local Development Execution

To run the local development server:

```powershell
python server.py
```
Default local port: `http://localhost:9100`

To run the cloud runtime container locally:
```powershell
cd Deployment/cloud
docker compose up --build
```
