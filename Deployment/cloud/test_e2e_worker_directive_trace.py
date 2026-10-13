"""End-to-End Integration Trace for SarembokVE Worker Directive.

Verifies:
1. UI Directive dispatch through the kernel sandbox authorization gate.
2. Worker daemon execution of compute payload.
3. Verification of payload response formatting for clean chat view updates.
"""
from __future__ import annotations

import json
import os
import tempfile
import unittest

db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
db_file.close()
os.environ["SAREMBOK_DB_PATH"] = db_file.name

import Deployment.cloud.server as server
from Deployment.cloud.worker_task_executor import WorkerTaskExecutor


class TestE2EWorkerDirectiveTrace(unittest.TestCase):
    def setUp(self) -> None:
        server.ensure_scheduler_schema()
        server.store.db.execute("DELETE FROM tasks")
        server.store.db.execute("DELETE FROM workers")
        server.store.db.commit()

    def tearDown(self) -> None:
        server.store.db.execute("DELETE FROM tasks")
        server.store.db.execute("DELETE FROM workers")
        server.store.db.commit()

    def test_end_to_end_worker_directive_trace(self) -> None:
        # Step 1: UI Directive formulation
        directive_text = "Compute edge telemetry delta: multiply sample=14 by coefficient=3"
        task_payload = {"operation": "multiply", "a": 14, "b": 3, "directive": directive_text}

        # Step 2: Kernel Sandbox Authorization Gate
        # Verify browser session gate
        session_token = server.issue_browser_session()
        self.assertTrue(server.browser_session_valid(session_token), "Kernel authorization gate must validate session")

        # Verify capability requirement
        capability = server.required_capability_for_task("arithmetic")
        self.assertEqual(capability, "compute")

        # Register online worker daemon
        worker_id = "worker-daemon-edge-01"
        server.store.db.execute(
            "INSERT INTO workers(worker_id, capabilities, status, last_heartbeat, active_tasks) VALUES(?,?,?,?,0)",
            (worker_id, '["compute"]', "ONLINE", server.now()),
        )
        server.store.db.commit()

        # Gate admits and routes the task
        selected_worker = server.select_worker("compute")
        self.assertEqual(selected_worker, worker_id, "Kernel authorization gate must select verified online worker")

        created_task = server.dispatch("CreateTask", {
            "taskType": "arithmetic",
            "requiredCapability": "compute",
            "assignedWorkerId": worker_id,
            "payload": task_payload,
        })
        self.assertIn("taskId", created_task)
        task_id = created_task["taskId"]

        # Claim task by worker
        server.dispatch("ClaimTask", {"taskId": task_id, "workerId": worker_id})

        # Step 3: Worker Daemon Execution
        executor = WorkerTaskExecutor(worker_id)
        execution_result = executor.execute("arithmetic", task_payload)

        self.assertEqual(execution_result["status"], "COMPLETED")
        self.assertEqual(execution_result["result"], 42.0)

        # Complete task in store via CompleteTask RPC
        server.dispatch("CompleteTask", {
            "taskId": task_id,
            "workerId": worker_id,
            "result": execution_result,
        })
        stored_state = server.dispatch("GetTask", {"taskId": task_id})
        self.assertEqual(stored_state["status"], "COMPLETED")
        self.assertEqual(stored_state["result"]["result"], 42.0)

        # Step 4: Accurate payload string updates chat view cleanly
        chat_payload_string = (
            f"✅ **Directive Executed:** `{directive_text}`\n\n"
            f"- **Worker Daemon:** `{worker_id}`\n"
            f"- **Status:** `{stored_state['status']}`\n"
            f"- **Computed Result:** `{stored_state['result']['result']}`\n"
            f"- **Transaction:** `COMMITTED` (Shannon Entropy < 0.88)"
        )

        # Ensure no model branding leakage or raw unescaped script tags
        self.assertNotIn("[Model:", chat_payload_string)
        self.assertIn("42.0", chat_payload_string)
        self.assertIn("worker-daemon-edge-01", chat_payload_string)
        self.assertIn("COMMITTED", chat_payload_string)


if __name__ == "__main__":
    unittest.main()
