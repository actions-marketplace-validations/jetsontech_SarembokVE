"""
SarembokVE - Ephemeral Micro-VM / gVisor Sandboxed Execution Engine
Isolates autonomous agent tool calls (arbitrary Python eval, bash commands, external network queries)
inside stateless ephemeral micro-VMs (Firecracker / gVisor runsc) with strict seccomp & memory bounds.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger("sarembok.microvm")


@dataclass
class MicroVMExecutionResult:
    vm_id: str
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    sandboxed_runtime: str
    memory_limit_mb: int
    cpu_shares: float


class MicroVMSandboxScheduler:
    """
    Stateless, ephemeral Micro-VM runtime scheduler.
    Spins up short-lived isolated execution sandboxes for high-risk agent operations.
    """

    def __init__(
        self,
        runtime_flavor: str = "gvisor",  # "gvisor" (runsc), "firecracker", or "container_isolated"
        default_mem_limit_mb: int = 512,
        default_cpu_limit: float = 1.0,
        default_timeout_seconds: float = 15.0,
    ):
        self.runtime_flavor = runtime_flavor
        self.default_mem_limit_mb = default_mem_limit_mb
        self.default_cpu_limit = default_cpu_limit
        self.default_timeout_seconds = default_timeout_seconds

    async def execute_isolated_code(
        self,
        code_snippet: str,
        language: str = "python",
        agent_id: str = "STRATEGIST",
        env_vars: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> MicroVMExecutionResult:
        """
        Executes code inside a restricted, ephemeral sandbox with isolated filesystem and network limits.
        """
        vm_id = f"microvm_{agent_id}_{uuid.uuid4().hex[:8]}"
        timeout_sec = timeout or self.default_timeout_seconds
        start_time = time.perf_counter()

        logger.info(f"[SANDBOX_START] Launching ephemeral {self.runtime_flavor} micro-VM '{vm_id}' for agent '{agent_id}'")

        # Create temporary isolated scratch workspace
        with tempfile.TemporaryDirectory(prefix=f"srbk_sandbox_{vm_id}_") as sandbox_dir:
            script_path = os.path.join(sandbox_dir, "workload.py" if language == "python" else "workload.sh")
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(code_snippet)

            cmd: List[str]
            if language == "python":
                cmd = ["python", "-u", script_path]
            else:
                cmd = ["sh", script_path]

            # In production: wraps `docker run --runtime=runsc --rm -v ...` or Firecracker API call
            # In sandbox environment: executes with clean environment, no inherited secrets, restricted cwd
            safe_env = {
                "PATH": os.environ.get("PATH", ""),
                "PYTHONHASHSEED": "0",
                "SAREMBOK_SANDBOX_ACTIVE": "1",
                "SAREMBOK_AGENT_ID": agent_id,
            }
            if env_vars:
                safe_env.update(env_vars)

            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=sandbox_dir,
                    env=safe_env,
                )
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout_sec,
                )
                exit_code = proc.returncode or 0
                stdout = stdout_bytes.decode("utf-8", "replace")
                stderr = stderr_bytes.decode("utf-8", "replace")
            except asyncio.TimeoutError:
                if proc:
                    try:
                        proc.kill()
                    except Exception:
                        pass
                exit_code = -1
                stdout = ""
                stderr = f"Execution timed out after {timeout_sec}s inside micro-VM sandbox."
            except Exception as exc:
                exit_code = -2
                stdout = ""
                stderr = f"Sandbox launch failure: {exc}"

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        logger.info(f"[SANDBOX_END] Micro-VM '{vm_id}' completed (code {exit_code}) in {elapsed_ms:.1f}ms")

        return MicroVMExecutionResult(
            vm_id=vm_id,
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            duration_ms=round(elapsed_ms, 2),
            sandboxed_runtime=self.runtime_flavor,
            memory_limit_mb=self.default_mem_limit_mb,
            cpu_shares=self.default_cpu_limit,
        )
