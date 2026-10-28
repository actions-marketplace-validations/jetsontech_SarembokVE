#!/usr/bin/env python3
# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""
SarembokVE - Dedicated RunPod Sovereign GPU Worker Daemon
Maintains a standing, persistent WebSocket connection to the Sarembok cluster
and executes high-entropy reasoning & specification workloads on dedicated GPU pools.
"""

import argparse
import asyncio
import json
import logging
import os
import platform
import socket
import sys
import time
from datetime import datetime, timezone
from typing import Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [runpod-mesh] %(message)s")
LOG = logging.getLogger("runpod_worker")

# Import the concrete WorkerTaskExecutor from colab_worker
try:
    from colab_worker import WorkerTaskExecutor, get_colab_gpu
except ImportError:
    # If running from another directory
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from colab_worker import WorkerTaskExecutor, get_colab_gpu


class RunPodWorkerDaemon:
    def __init__(self, server_url: str, worker_id: str | None = None, token: str | None = None, models: list[str] | None = None) -> None:
        self.server_url = server_url.rstrip("/")
        self.worker_id = worker_id or f"runpod-{socket.gethostname()[:8]}-{os.urandom(3).hex()}"
        self.token = token or os.getenv("SAREMBOK_WORKER_TOKEN", "runpod-mesh-node")
        self.gpu_info = get_colab_gpu()
        self.models = models or ["qwen-2.5-coder-32b", "qwen-2.5-coder-7b"]
        self.executor = WorkerTaskExecutor(worker_id=self.worker_id, gpu_info=self.gpu_info)
        self.is_running = True

    def get_capabilities(self) -> list[str]:
        caps = self.executor.capabilities()
        caps.extend(["runpod_dedicated", "standby_pool", "zero_downtime"])
        return sorted(list(set(caps)))

    async def run(self) -> None:
        """Run the persistent connection loop with automatic exponential backoff."""
        import websockets

        backoff = 2.0
        while self.is_running:
            try:
                LOG.info(f"Connecting to Sarembok Sovereign Cluster: {self.server_url} (Worker ID: {self.worker_id})")
                LOG.info(f"Detected Hardware: {self.gpu_info.get('gpuModel', 'CPU')} ({self.gpu_info.get('vramMb', 0)} MB VRAM)")
                LOG.info(f"Serving Sovereign Models: {', '.join(self.models)}")

                async with websockets.connect(
                    f"{self.server_url}?worker_id={self.worker_id}&token={self.token}",
                    ping_interval=20,
                    ping_timeout=15,
                ) as ws:
                    LOG.info("✔ CONNECTED TO CENTRAL DISPATCHER. Registered in standing compute mesh.")
                    backoff = 2.0

                    # 1. Send registration handshake
                    reg_payload = {
                        "jsonrpc": "2.0",
                        "method": "RegisterWorker",
                        "params": {
                            "workerId": self.worker_id,
                            "token": self.token,
                            "capabilities": self.get_capabilities(),
                            "models": self.models,
                            "gpu": self.gpu_info,
                            "platform": platform.platform(),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                        "id": "init-1",
                    }
                    await ws.send(json.dumps(reg_payload))

                    # 2. Main message loop
                    async for raw_msg in ws:
                        try:
                            msg = json.loads(raw_msg)
                            method = msg.get("method")
                            msg_id = msg.get("id")

                            if method == "Ping":
                                await ws.send(json.dumps({"jsonrpc": "2.0", "result": "pong", "id": msg_id}))
                                continue

                            if method in ("ExecuteTask", "DispatchInference", "DispatchSpecAudit"):
                                params = msg.get("params", {})
                                task_type = params.get("taskType", "inference")
                                payload = params.get("payload", params)

                                LOG.info(f"⚡ Received task: {task_type} (Model: {payload.get('model', 'default')})")
                                res = self.executor.execute(task_type, payload)

                                await ws.send(json.dumps({
                                    "jsonrpc": "2.0",
                                    "result": res,
                                    "id": msg_id,
                                }))
                                LOG.info(f"✔ Completed task {task_type} in {res.get('latencyMs', 0):.1f}ms")
                        except Exception as loop_err:
                            LOG.error(f"Error handling task: {loop_err}")

            except Exception as conn_err:
                LOG.warning(f"Connection lost ({conn_err}). Reconnecting in {backoff:.1f}s...")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 1.5, 30.0)


def main() -> None:
    parser = argparse.ArgumentParser(description="SarembokVE RunPod Sovereign GPU Worker Daemon")
    parser.add_argument("--server", default=os.getenv("SAREMBOK_SERVER", "wss://sarembok.com/worker/ws"), help="Central cluster worker WebSocket URL")
    parser.add_argument("--worker-id", default=None, help="Custom Worker ID")
    parser.add_argument("--token", default=os.getenv("SAREMBOK_WORKER_TOKEN", "runpod-token"), help="Worker enrollment token")
    parser.add_argument("--models", default="qwen-2.5-coder-32b,qwen-2.5-coder-7b", help="Comma-separated model names")
    args = parser.parse_args()

    daemon = RunPodWorkerDaemon(
        server_url=args.server,
        worker_id=args.worker_id,
        token=args.token,
        models=[m.strip() for m in args.models.split(",") if m.strip()],
    )
    asyncio.run(daemon.run())


if __name__ == "__main__":
    main()
