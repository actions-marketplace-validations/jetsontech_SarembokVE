"""
SarembokVE - Decoupled L1 SQLite-WAL Memory Manager
Architectural Directive: Single-Writer Actor Queue with Non-Blocking In-Memory Ingestion.
Ensures ZERO database locking across 25+ concurrent agent loops.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import sqlite3
import threading
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("sarembok.wal_memory")


OPTIMAL_PRAGMAS = [
    "PRAGMA journal_mode = WAL;",
    "PRAGMA synchronous = NORMAL;",
    "PRAGMA busy_timeout = 30000;",
    "PRAGMA wal_autocheckpoint = 1000;",
    "PRAGMA cache_size = -64000;",          # 64 MB page cache
    "PRAGMA mmap_size = 268435456;",         # 256 MB memory-mapped I/O
    "PRAGMA temp_store = MEMORY;",
]

SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS agent_wal (
    step_id TEXT PRIMARY KEY,
    agent_node TEXT NOT NULL,
    directive TEXT,
    entropy REAL DEFAULT 0.0,
    status TEXT DEFAULT 'RECORDED',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Strict B-Tree Indices to guarantee O(log N) lookups and avoid lock stalls
CREATE INDEX IF NOT EXISTS idx_agent_wal_node_ts ON agent_wal(agent_node, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_wal_ts ON agent_wal(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_wal_status ON agent_wal(status);
CREATE INDEX IF NOT EXISTS idx_system_state_updated ON system_state(updated_at DESC);
"""


class WalWriteOperation:
    def __init__(self, op_type: str, data: Dict[str, Any], future: Optional[asyncio.Future] = None):
        self.op_type = op_type
        self.data = data
        self.future = future


class WalMemoryManager:
    """
    Decoupled L1 WAL Memory Engine.
    Transitions SQLite writes entirely out of the active agent execution loops.
    Agents submit mutations to an in-memory unbounded queue; a dedicated single-writer
    worker thread executes batch commits in WAL mode with aggressive busy timeouts.
    """

    _instance: Optional["WalMemoryManager"] = None
    _lock = threading.Lock()

    def __init__(self, db_path: str = "sarembok_memory.db"):
        self.db_path = db_path
        self._write_queue: queue.Queue[WalWriteOperation] = queue.Queue()
        self._stop_event = threading.Event()
        self._writer_thread: Optional[threading.Thread] = None
        self._initialized = False
        self._init_lock = threading.Lock()
        self.start()

    @classmethod
    def get_instance(cls, db_path: str = "sarembok_memory.db") -> "WalMemoryManager":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(db_path)
            return cls._instance

    def _configure_connection(self, conn: sqlite3.Connection) -> None:
        conn.row_factory = sqlite3.Row
        for pragma in OPTIMAL_PRAGMAS:
            try:
                conn.execute(pragma)
            except sqlite3.Error as exc:
                logger.warning(f"Failed to apply {pragma}: {exc}")

    def _bootstrap_schema(self) -> None:
        with sqlite3.connect(self.db_path, timeout=30.0) as conn:
            self._configure_connection(conn)
            conn.executescript(SCHEMA_DDL)
            conn.commit()
            logger.info(f"[L1_WAL] Bootstrapped structured schema and strict indices on {self.db_path}")

    def start(self) -> None:
        with self._init_lock:
            if self._initialized:
                return
            self._bootstrap_schema()
            self._stop_event.clear()
            self._writer_thread = threading.Thread(
                target=self._writer_loop,
                name="Sarembok-Wal-Writer",
                daemon=True,
            )
            self._writer_thread.start()
            self._initialized = True
            logger.info("[L1_WAL] Decoupled background writer thread started successfully.")

    def stop(self) -> None:
        self._stop_event.set()
        if self._writer_thread and self._writer_thread.is_alive():
            self._write_queue.put(WalWriteOperation("SHUTDOWN", {}))
            self._writer_thread.join(timeout=3.0)
        self._initialized = False

    def _writer_loop(self) -> None:
        """
        Single dedicated writer thread consuming operations from the memory queue.
        Executes writes in micro-batches (up to 100 ops or 10ms max latency).
        """
        conn = sqlite3.connect(self.db_path, timeout=30.0, check_same_thread=False)
        self._configure_connection(conn)

        while not self._stop_event.is_set():
            try:
                # Wait for at least one item
                try:
                    op = self._write_queue.get(timeout=0.05)
                except queue.Empty:
                    continue

                if op.op_type == "SHUTDOWN":
                    break

                batch = [op]
                # Drain available items up to 100 for high-efficiency group commit
                while len(batch) < 100:
                    try:
                        next_op = self._write_queue.get_nowait()
                        if next_op.op_type == "SHUTDOWN":
                            break
                        batch.append(next_op)
                    except queue.Empty:
                        break

                # Execute batch transaction
                try:
                    with conn:
                        for item in batch:
                            if item.op_type == "STEP":
                                conn.execute(
                                    """
                                    INSERT OR REPLACE INTO agent_wal 
                                    (step_id, agent_node, directive, entropy, status, timestamp)
                                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                                    """,
                                    (
                                        item.data["step_id"],
                                        item.data["agent_node"],
                                        item.data["directive"],
                                        item.data.get("entropy", 0.0),
                                        item.data.get("status", "RECORDED"),
                                    ),
                                )
                            elif item.op_type == "SYSTEM_STATE":
                                conn.execute(
                                    """
                                    INSERT OR REPLACE INTO system_state (key, value, updated_at)
                                    VALUES (?, ?, CURRENT_TIMESTAMP)
                                    """,
                                    (item.data["key"], str(item.data["value"])),
                                )
                            elif item.op_type == "RAW_SQL":
                                conn.execute(item.data["sql"], item.data.get("params", ()))

                    # Signal completion if futures were attached
                    for item in batch:
                        if item.future and not item.future.done():
                            try:
                                loop = item.future.get_loop()
                                if loop.is_running():
                                    loop.call_soon_threadsafe(item.future.set_result, True)
                            except Exception:
                                pass

                except sqlite3.Error as exc:
                    logger.error(f"[L1_WAL_ERROR] Batch write commit failed: {exc}", exc_info=True)
                    for item in batch:
                        if item.future and not item.future.done():
                            try:
                                loop = item.future.get_loop()
                                if loop.is_running():
                                    loop.call_soon_threadsafe(item.future.set_exception, exc)
                            except Exception:
                                pass

            except Exception as outer_exc:
                logger.error(f"[L1_WAL_UNEXPECTED] Loop error: {outer_exc}", exc_info=True)

        try:
            conn.close()
        except Exception:
            pass

    # Non-blocking synchronous queue ingestion (zero blocking for active agent loops)
    def record_step_nowait(
        self,
        step_id: str,
        agent_node: str,
        directive: str,
        entropy: float = 0.0,
        status: str = "RECORDED",
    ) -> None:
        self._write_queue.put_nowait(
            WalWriteOperation(
                "STEP",
                {
                    "step_id": step_id,
                    "agent_node": agent_node,
                    "directive": directive,
                    "entropy": entropy,
                    "status": status,
                },
            )
        )

    # Async non-blocking ingestion
    async def record_step_async(
        self,
        step_id: str,
        agent_node: str,
        directive: str,
        entropy: float = 0.0,
        status: str = "RECORDED",
        wait_flush: bool = False,
    ) -> None:
        loop = asyncio.get_running_loop()
        future = loop.create_future() if wait_flush else None
        self._write_queue.put_nowait(
            WalWriteOperation(
                "STEP",
                {
                    "step_id": step_id,
                    "agent_node": agent_node,
                    "directive": directive,
                    "entropy": entropy,
                    "status": status,
                },
                future=future,
            )
        )
        if wait_flush and future:
            await future

    def set_system_state_nowait(self, key: str, value: Any) -> None:
        self._write_queue.put_nowait(
            WalWriteOperation("SYSTEM_STATE", {"key": key, "value": value})
        )

    # Read queries use isolated read-only snapshot connections with zero writer blocking
    def get_agent_history(self, agent_node: str, limit: int = 50) -> List[Dict[str, Any]]:
        with sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True, timeout=10.0) as conn:
            self._configure_connection(conn)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT step_id, agent_node, directive, entropy, status, timestamp
                FROM agent_wal
                WHERE agent_node = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (agent_node, limit),
            )
            return [dict(row) for row in cursor.fetchall()]

    def get_latest_state(self) -> Dict[str, str]:
        with sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True, timeout=10.0) as conn:
            self._configure_connection(conn)
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM system_state")
            return {row["key"]: row["value"] for row in cursor.fetchall()}

    def checkpoint(self) -> None:
        """Executes passive WAL checkpoint without blocking active writers."""
        with sqlite3.connect(self.db_path, timeout=30.0) as conn:
            conn.execute("PRAGMA wal_checkpoint(PASSIVE);")
