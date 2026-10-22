# Sarembok VE Architecture Guide

## Overview

Sarembok VE is designed as a modular, hardware-adaptive digital human and autonomous intelligence platform consisting of five core layers:

1. **Edge Transport Layer (Caddy)**: Public HTTPS and WSS entry point providing automated TLS termination, security header injection, and reverse proxying.
2. **Web Operator Layer (Frontend)**: Single-page Web application serving a public landing showcase and an authenticated operator control plane for real-time monitoring and management.
3. **Cloud Runtime Core (`sarembok-runtime`)**: Asynchronous Python process (`server.py`) handling SQLite persistence, JSON-RPC 2.0 dispatch, GPU compute scheduling, and digital human session routing.
   - **Multi-Sector Real-Time Parallel Fan-Out Engine**: ThreadPool concurrent dispatch that splits cross-sector queries into parallel workers, retrieving live asset quotes and domain news feeds across 15 standard industry sectors with sub-second latency.
   - **Argon Telemetry Substrate**: High-contrast, mathematically precise SVG vector graphics synthesis engine providing visual execution cards, live candlestick/sparkline rendering, and flow topology graphs.
4. **Neural Pod Services**:
   - **Voice Pod (`sarembok-voice`)**: Kokoro-82M neural TTS model serving low-latency speech synthesis over internal HTTP.
   - **Browser Pod (`sarembok-browser`)**: Playwright headless Chromium container executing web crawlers, DOM inspection, and automated API specification extraction in an ephemeral sandbox.
5. **Engine Client Layer (Unreal Engine 5.8)**: In-engine C++ subsystem plugins (`SarembokBridge`, `SarembokAvatar`, `SarembokVoice`, `SarembokVision`, `SarembokAgent`, `SarembokMemory`) executing real-time morph targets, speech, perception, and reasoning loops.

---

## Data Flow Diagram

```text
User / Operator / API Client
      │
      ├─── HTTP GET / ────────► Caddy Edge ───► Static Web App (index.html, docs, projects)
      │
      └─── WSS /ws ───────────► Caddy Edge ───► sarembok-runtime (server.py)
                                                      │
                                                      ├──► Multi-Sector Parallel Fan-Out (ThreadPool)
                                                      │     ├── Yahoo Finance Chart API (XLK, XLE, etc.)
                                                      │     └── Google News RSS Feeds
                                                      │
                                                      ├──► Argon SVG Vector Synthesis Substrate
                                                      │
                                                      ├──► Neural Voice Pod (sarembok-voice :8880)
                                                      │
                                                      ├──► Ephemeral Browser Sandbox (sarembok-browser :9100)
                                                      │
                                                      ├──► SQLite WAL (/data/sarembok_cloud.db)
                                                      │
                                                      ├──► GPU Worker Pool (Colab / Local nodes)
                                                      │
                                                      └──► Digital Human Sessions (Unreal Engine 5.8)
```

---

## Storage Architecture

All runtime state is stored in `/data/sarembok_cloud.db` using SQLite with Write-Ahead Logging (WAL):

- `agents`: Autonomous agent identities and status.
- `workers`: GPU compute node capabilities, VRAM, and heartbeat timestamps.
- `digital_human_sessions`: Active avatar sessions and assigned worker mappings.
- `tasks`: Compute scheduler queue and execution history.
- `events`: Append-only structured system audit trail.
- `messages`: Agent conversation log history.
- `delegations`: Inter-agent goal delegation hierarchy.
