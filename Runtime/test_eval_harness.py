# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""Comprehensive verification tests for the Agent Evaluation Harness and Task Distributor."""

from __future__ import annotations

import time
import unittest
from typing import Any, Dict

from Runtime.eval_harness import (
    AgentEvaluationHarness,
    AgentTaskRequest,
    EvaluationReport,
    EvaluationTimeoutException,
    IsolatedLoopTeardown,
    LogicalLoopException,
    LoopDetector,
    PolicyViolationException,
    RuntimeTaskDistributor,
    ToolCallAttempt,
    UnregisteredCapabilityException,
)
from Runtime.sarembok_capabilities import (
    CapabilityClass,
    CapabilityDescriptor,
    CapabilityPolicy,
    CapabilityRegistry,
    RiskLevel,
)


class TestAgentEvaluationHarness(unittest.TestCase):
    def setUp(self) -> None:
        self.harness = AgentEvaluationHarness(
            step_timeout_seconds=1.5,
            session_timeout_seconds=3.0,
        )

    def test_registered_capability_evaluates_successfully(self) -> None:
        attempt = ToolCallAttempt(
            tool_name="kernel.observe_system",
            arguments={"query": "health"},
            node_role="STRATEGIST",
        )
        result = self.harness.evaluate_step(attempt)
        self.assertEqual(result.status, "SUCCESS")
        self.assertIsNotNone(result.result)
        self.assertEqual(result.result.get("system"), "healthy")
        self.assertTrue(result.duration_ms >= 0.0)

    def test_unregistered_capability_is_rejected_offline(self) -> None:
        attempt = ToolCallAttempt(
            tool_name="unregistered.arbitrary_hack",
            arguments={"cmd": "whoami"},
            node_role="WORKER",
        )
        with self.assertRaises(UnregisteredCapabilityException):
            self.harness.evaluate_step(attempt)
        self.assertEqual(attempt.status, "UNREGISTERED")

    def test_policy_violation_denied_by_boundary(self) -> None:
        # hardware.cloud_allocate has RiskLevel.HIGH and requires hardware.high_cost
        attempt = ToolCallAttempt(
            tool_name="hardware.cloud_allocate",
            arguments={"slice_type": "A100", "hours": 2},
            node_role="WORKER",
        )
        # Default policy does not approve hardware.high_cost or high-risk execution
        with self.assertRaises(PolicyViolationException):
            self.harness.evaluate_step(attempt)
        self.assertEqual(attempt.status, "POLICY_DENIED")
        self.assertFalse(attempt.policy_permitted)

    def test_valid_multi_step_trajectory_evaluation(self) -> None:
        attempts = [
            ToolCallAttempt(
                tool_name="kernel.observe_system",
                arguments={"query": "status"},
                node_role="STRATEGIST",
            ),
            ToolCallAttempt(
                tool_name="memory.semantic_search",
                arguments={"query": "kernel_architecture"},
                node_role="STRATEGIST",
            ),
            ToolCallAttempt(
                tool_name="planner.decompose_task",
                arguments={"task": "deploy_eval_harness"},
                node_role="STRATEGIST",
            ),
            ToolCallAttempt(
                tool_name="code.execute_sandbox",
                arguments={"code": "print('compiled')"},
                node_role="WORKER",
            ),
            ToolCallAttempt(
                tool_name="audit.verify_signature",
                arguments={"record_hash": "0xabc123"},
                node_role="AUDITOR",
            ),
        ]
        report = self.harness.evaluate_trajectory(
            goal="Compile and audit kernel payload",
            attempts=attempts,
            agent_id="STRATEGIST",
        )
        self.assertEqual(report.total_steps, 5)
        self.assertEqual(report.successful_calls, 5)
        self.assertEqual(report.failed_calls, 0)
        self.assertEqual(report.accuracy_score, 1.0)
        self.assertEqual(report.reasoning_coherence, 1.0)
        self.assertFalse(report.loop_detected)
        self.assertEqual(report.allocated_hardware_tier, "CLOUD_RTX4090_A100")


class TestLoopDetector(unittest.TestCase):
    def setUp(self) -> None:
        self.detector = LoopDetector(
            max_identical_repeats=3,
            max_oscillation_cycles=2,
            max_steps=10,
        )

    def test_identical_consecutive_loop_detection(self) -> None:
        attempts = [
            ToolCallAttempt(tool_name="memory.semantic_search", arguments={"query": "loop"}),
            ToolCallAttempt(tool_name="memory.semantic_search", arguments={"query": "loop"}),
            ToolCallAttempt(tool_name="memory.semantic_search", arguments={"query": "loop"}),
        ]
        loop_flag = None
        for a in attempts:
            loop_flag = self.detector.inspect_step(a)
        self.assertIsNotNone(loop_flag)
        self.assertIn("CONSECUTIVE_REPEAT_LOOP", loop_flag)

    def test_two_phase_oscillation_cycle_detection(self) -> None:
        # Pattern: A -> B -> A -> B
        attempts = [
            ToolCallAttempt(tool_name="tool_A", arguments={"x": 1}),
            ToolCallAttempt(tool_name="tool_B", arguments={"y": 2}),
            ToolCallAttempt(tool_name="tool_A", arguments={"x": 1}),
            ToolCallAttempt(tool_name="tool_B", arguments={"y": 2}),
        ]
        loop_flag = None
        for a in attempts:
            loop_flag = self.detector.inspect_step(a)
        self.assertIsNotNone(loop_flag)
        self.assertIn("OSCILLATION_CYCLE_LOOP", loop_flag)

    def test_three_phase_oscillation_cycle_detection(self) -> None:
        # Pattern: A -> B -> C -> A -> B -> C
        attempts = [
            ToolCallAttempt(tool_name="tool_A", arguments={"x": 1}),
            ToolCallAttempt(tool_name="tool_B", arguments={"y": 2}),
            ToolCallAttempt(tool_name="tool_C", arguments={"z": 3}),
            ToolCallAttempt(tool_name="tool_A", arguments={"x": 1}),
            ToolCallAttempt(tool_name="tool_B", arguments={"y": 2}),
            ToolCallAttempt(tool_name="tool_C", arguments={"z": 3}),
        ]
        loop_flag = None
        for a in attempts:
            loop_flag = self.detector.inspect_step(a)
        self.assertIsNotNone(loop_flag)
        self.assertIn("OSCILLATION_CYCLE_LOOP", loop_flag)

    def test_max_steps_budget_enforced(self) -> None:
        loop_flag = None
        for i in range(12):
            a = ToolCallAttempt(tool_name=f"unique_tool_{i}", arguments={"i": i})
            loop_flag = self.detector.inspect_step(a)
        self.assertIsNotNone(loop_flag)
        self.assertIn("STEP_BUDGET_EXCEEDED", loop_flag)


class TestIsolatedLoopTeardown(unittest.TestCase):
    def test_stuck_routine_terminated_by_isolated_teardown(self) -> None:
        teardown = IsolatedLoopTeardown("test_stuck_session", timeout_seconds=0.3)

        def stuck_func() -> None:
            time.sleep(2.0)

        with teardown:
            with self.assertRaises(EvaluationTimeoutException):
                teardown.run_isolated(stuck_func, timeout=0.3)

        # Confirm teardown cleaned scratch space and didn't block runner
        self.assertIsNone(teardown.scratch_dir)

    def test_teardown_purges_scratch_directory(self) -> None:
        teardown = IsolatedLoopTeardown("test_scratch_purge", timeout_seconds=1.0)
        scratch = teardown.setup()
        import os
        self.assertTrue(os.path.isdir(scratch))
        teardown.teardown()
        self.assertFalse(os.path.isdir(scratch))


class TestRuntimeTaskDistributor(unittest.TestCase):
    def test_decision_first_ranking_under_nominal_retrieval(self) -> None:
        nominal_stats = lambda: {"p95_ms": 18.0, "sla_compliant": True}
        distributor = RuntimeTaskDistributor(retrieval_stats_hook=nominal_stats)

        tasks = [
            AgentTaskRequest("task_worker_1", node_role="WORKER", complexity_score=0.8, estimated_tool_steps=5),
            AgentTaskRequest("task_strat_1", node_role="STRATEGIST", complexity_score=0.8, estimated_tool_steps=3),
            AgentTaskRequest("task_audit_1", node_role="AUDITOR", complexity_score=0.8, estimated_tool_steps=2),
        ]

        ranked = distributor.rank_workloads(tasks)
        # STRATEGIST base weight 1.25 > AUDITOR 1.10 > WORKER 1.00
        self.assertEqual(ranked[0][0].node_role, "STRATEGIST")
        self.assertEqual(ranked[1][0].node_role, "AUDITOR")
        self.assertEqual(ranked[2][0].node_role, "WORKER")

    def test_degraded_retrieval_sla_boosts_strategist_pruning(self) -> None:
        degraded_stats = lambda: {"p95_ms": 68.5, "sla_compliant": False}
        distributor = RuntimeTaskDistributor(retrieval_stats_hook=degraded_stats)

        tasks = [
            AgentTaskRequest("heavy_worker", node_role="WORKER", complexity_score=0.9, estimated_tool_steps=8),
            AgentTaskRequest("light_strat", node_role="STRATEGIST", complexity_score=0.4, estimated_tool_steps=2),
        ]

        ranked = distributor.rank_workloads(tasks)
        # With degraded retrieval (>45ms), STRATEGIST is boosted to 1.60 and WORKER is penalized to 0.80
        self.assertEqual(ranked[0][0].node_role, "STRATEGIST")

    def test_cloud_gpu_gating_prevents_unverified_allocation(self) -> None:
        nominal_stats = lambda: {"p95_ms": 20.0, "sla_compliant": True}
        distributor = RuntimeTaskDistributor(retrieval_stats_hook=nominal_stats)

        tasks = [
            AgentTaskRequest("gpu_task_1", node_role="WORKER", complexity_score=0.8, estimated_tool_steps=3, requires_cloud_gpu=True),
            AgentTaskRequest("gpu_task_looping", node_role="WORKER", complexity_score=0.8, estimated_tool_steps=3, requires_cloud_gpu=True),
        ]

        # Simulate eval report where gpu_task_looping had a detected loop
        mock_evals = {
            "gpu_task_1": EvaluationReport("s1", "W", "goal", [], 5, 5, 0, 1.0, 1.0, 1.0, loop_detected=False),
            "gpu_task_looping": EvaluationReport("s2", "W", "goal", [], 5, 2, 3, 0.4, 0.2, 0.5, loop_detected=True),
        }

        ranked = distributor.rank_workloads(tasks, eval_reports=mock_evals)
        allocations = {item[0].task_id: item[2] for item in ranked}
        self.assertEqual(allocations["gpu_task_1"], "CLOUD_RTX4090_A100")
        self.assertEqual(allocations["gpu_task_looping"], "LOCAL_SANDBOX")


if __name__ == "__main__":
    unittest.main()
