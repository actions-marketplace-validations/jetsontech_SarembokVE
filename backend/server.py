#!/usr/bin/env python3
"""
SarembokVE Backend Server & WAL-Safe State Mirror
Provides non-blocking parallel read access to SQLite-WAL ledger and hosts the core control plane.
"""

import os
import sys
import json
import sqlite3
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SarembokBackend] %(message)s"
)
logger = logging.getLogger("SarembokBackend")

class SarembokStateMirror:
    """
    WAL-Safe State Access Mirror
    Opens parallel read-only connections to SQLite-WAL ledger with zero file locks.
    """
    def __init__(self, db_relative_path="sarembok_memory.db"):
        root_dir = Path(__file__).resolve().parent.parent
        self.db_path = (root_dir / db_relative_path).resolve()

    def _get_connection(self):
        if not self.db_path.exists():
            # If database doesn't exist yet, connect normally to create/read
            conn = sqlite3.connect(str(self.db_path))
        else:
            # Open parallel read connection to SQLite-WAL ledger without file locks
            db_uri = f"{self.db_path.as_uri()}?mode=ro"
            conn = sqlite3.connect(db_uri, uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def fetch_latest_entropy_breach(self):
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, agent_role, entropy_score, timestamp 
                FROM cognitive_traces 
                ORDER BY id DESC LIMIT 1
            ''')
            row = cursor.fetchone()
            return dict(row) if row else None
        except sqlite3.OperationalError:
            return None
        finally:
            if conn:
                conn.close()

    def fetch_recent_traces(self, limit=10):
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, agent_role, state_hash, prompt_tokens, entropy_score, timestamp
                FROM cognitive_traces
                ORDER BY id DESC LIMIT ?
            ''', (limit,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except sqlite3.OperationalError:
            return []
        finally:
            if conn:
                conn.close()


def main():
    logger.info("Initializing Sarembok Backend Server Substrate...")
    mirror = SarembokStateMirror()
    breach = mirror.fetch_latest_entropy_breach()
    logger.info(f"Connected to SQLite-WAL ledger: {mirror.db_path}")
    logger.info(f"Latest cognitive trace telemetry: {breach or 'Nominal (No prior traces)'}")
    
    # Check if root server.py exists and run it if invoked as master engine
    root_server = Path(__file__).resolve().parent.parent / "server.py"
    if root_server.exists():
        logger.info(f"Dispatching to Sovereign Kernel in {root_server}...")
        import runpy
        runpy.run_path(str(root_server), run_name="__main__")
    else:
        logger.info("Backend standby mode active.")

if __name__ == "__main__":
    main()
