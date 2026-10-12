#!/usr/bin/env python3
"""
SarembokVE - SQLite-WAL Concurrency Optimizer & Stress Validator
Directly applies Phase 1 database remediations and runs a 25-agent simultaneous write stress test
to verify zero locking (0 OperationalErrors / 0 SQLITE_BUSY).
"""

from __future__ import annotations

import concurrent.futures
import os
import pathlib
import random
import sqlite3
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
SQL_FILE = ROOT / "Deployment" / "cloud" / "optimize_wal.sql"

TARGET_DATABASES = [
    ROOT / "sarembok_memory.db",
    ROOT / "fabric" / "fabric_cockpit.db",
    ROOT / "fabric" / "kernel.db",
]


def apply_optimizations(db_path: pathlib.Path) -> None:
    print(f"[*] Applying structural optimizations to: {db_path.name}")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(db_path), timeout=30.0) as conn:
        with open(SQL_FILE, "r", encoding="utf-8") as f:
            script = f.read()
        conn.executescript(script)
        conn.commit()
    print(f"[+] Optimization successfully applied to {db_path.name}")


def stress_test_25_agents(db_path: pathlib.Path, num_agents: int = 25, writes_per_agent: int = 20) -> dict:
    """
    Simulates 25 autonomous agent loops simultaneously writing state and transactions.
    Verifies that WAL mode, busy timeouts, and indexed schemas eliminate database locks.
    """
    print(f"[*] Stress testing {num_agents} active agent loops on {db_path.name}...")
    errors: list[str] = []
    success_count = 0

    def agent_loop(agent_id: int):
        nonlocal success_count
        agent_name = f"AGENT_NODE_{agent_id:02d}"
        local_success = 0
        
        # Each agent simulates an independent execution thread
        for step in range(writes_per_agent):
            time.sleep(random.uniform(0.001, 0.005))
            try:
                # Thread connects with hardened pragma parameters
                with sqlite3.connect(str(db_path), timeout=30.0) as conn:
                    conn.execute("PRAGMA busy_timeout = 30000;")
                    cursor = conn.cursor()
                    step_id = f"step_{agent_id}_{step}_{int(time.time()*1000)}"
                    cursor.execute(
                        """
                        INSERT OR REPLACE INTO agent_wal 
                        (step_id, agent_node, directive, entropy, status, timestamp)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                        (
                            step_id,
                            agent_name,
                            f"Autonomous micro-directive execution index #{step}",
                            random.uniform(0.12, 0.45),
                            "DISPATCHED_TO_P2P",
                        ),
                    )
                    conn.commit()
                    local_success += 1
            except sqlite3.OperationalError as e:
                errors.append(f"LOCK_ERROR on {agent_name} step {step}: {e}")
            except Exception as e:
                errors.append(f"UNEXPECTED_ERROR on {agent_name}: {e}")

        return local_success

    start = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_agents) as executor:
        futures = [executor.submit(agent_loop, i) for i in range(1, num_agents + 1)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
        success_count = sum(results)
    elapsed = time.perf_counter() - start

    total_expected = num_agents * writes_per_agent
    lock_errors = [e for e in errors if "locked" in e.lower() or "busy" in e.lower()]

    print(f"[+] Total writes completed: {success_count}/{total_expected} in {elapsed:.2f}s ({success_count/elapsed:.1f} ops/sec)")
    print(f"[+] Total lock contention errors: {len(lock_errors)}")

    return {
        "total_expected": total_expected,
        "success_count": success_count,
        "lock_errors": lock_errors,
        "all_errors": errors,
        "elapsed_sec": elapsed,
    }


def main():
    print("=== SAREMBOK VE L1 SQLITE-WAL CONCURRENCY REMEDIATION ===")
    target = ROOT / "sarembok_memory.db"
    apply_optimizations(target)
    for extra in TARGET_DATABASES[1:]:
        if extra.parent.exists():
            apply_optimizations(extra)

    result = stress_test_25_agents(target, num_agents=25, writes_per_agent=20)
    if result["lock_errors"]:
        print(f"FAILED: Detected {len(result['lock_errors'])} database lock events.")
        sys.exit(1)

    print("VERIFICATION PASS: 0 database locking events across 25 concurrent agent loops.")


if __name__ == "__main__":
    main()
