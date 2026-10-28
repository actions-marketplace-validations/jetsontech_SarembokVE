# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""High-Volume Stress-Testing Suite for HNSW Retrieval Latency, Task Distribution, and Byzantine Quorum.

Simulates enterprise-scale conversational and task vector indexing, benchmarks p95
retrieval latency against the <45ms SLA, verifies dynamic worker-burst clamping and
Strategist decision-first boosting via RuntimeTaskDistributor, and tests multi-agent
Byzantine quorum consensus and entropy boundary enforcement.
"""

from __future__ import annotations

import time
import unittest
from typing import Any, Dict, List

from Runtime.consensus_network import (
    AutomatedConsensusNetwork,
    ConsensusStatus,
    Proposal,
    ShannonEntropyMonitor,
    VoteDecision,
)
from Runtime.dual_tier_memory import DualTierMemoryRouter
from Runtime.eval_harness import (
    AgentEvaluationHarness,
    AgentTaskRequest,
    EvaluationReport,
    RuntimeTaskDistributor,
)


class TestEnterpriseStressAndQuorum(unittest.TestCase):
    def setUp(self) -> None:
        self.router = DualTierMemoryRouter(l1_ttl_seconds=60)

    def test_01_hnsw_retrieval_latency_volume_benchmark(self) -> None:
        """Populates vector index with hundreds of task states and verifies retrieval SLA."""
        docs = [
            (
                f"state_{i}",
                f"Agent micro-step execution trace {i} with payload action for task {i % 25}",
                {"step_id": i, "agent": "WORKER", "status": "COMMITTED"},
            )
            for i in range(120)
        ]

        # Batch insert documents into L2 HNSW index
        t0 = time.perf_counter()
        count = self.router.l2.batch_insert(docs)
        insert_duration = time.perf_counter() - t0
        self.assertEqual(count, 120)
        self.assertTrue(insert_duration > 0)

        # Benchmark search queries
        query_latencies = []
        for q in [f"execution trace {k}" for k in range(30)]:
            t_q = time.perf_counter()
            results = self.router.query_semantic_long_term(q, top_k=5)
            dt_ms = (time.perf_counter() - t_q) * 1000.0
            query_latencies.append(dt_ms)
            self.assertTrue(len(results) > 0)

        stats = self.router.get_retrieval_stats()
        self.assertGreater(stats["sample_count"], 0)
        # Verify p95 retrieval latency is within the strict SLA boundary (< 45ms)
        self.assertLess(stats["p95_ms"], 45.0, f"p95 latency {stats['p95_ms']}ms exceeded 45ms SLA")
        self.assertTrue(stats["sla_compliant"])

    def test_02_runtime_task_distributor_clamps_worker_bursts_under_sla_breach(self) -> None:
        """Verifies RuntimeTaskDistributor throttles workers and boosts Strategist when SLA degrades."""
        # 1. Nominal retrieval scenario (< 45ms)
        nominal_hook = lambda: {"sample_count": 50, "p50_ms": 12.0, "p95_ms": 28.0, "p99_ms": 38.0, "sla_compliant": True}
        distributor_nominal = RuntimeTaskDistributor(retrieval_stats_hook=nominal_hook)

        tasks = [
            AgentTaskRequest("task_strat", node_role="STRATEGIST", complexity_score=0.7, estimated_tool_steps=3),
            AgentTaskRequest("task_worker_burst", node_role="WORKER", complexity_score=0.85, estimated_tool_steps=12),
            AgentTaskRequest("task_auditor", node_role="AUDITOR", complexity_score=0.75, estimated_tool_steps=2),
        ]

        ranked_nominal = distributor_nominal.rank_workloads(tasks)
        # In nominal mode, high-complexity worker competes normally
        worker_score_nominal = next(score for t, score, _ in ranked_nominal if t.task_id == "task_worker_burst")

        # 2. Degraded retrieval scenario (> 45ms breach)
        degraded_hook = lambda: {"sample_count": 50, "p50_ms": 42.0, "p95_ms": 58.4, "p99_ms": 78.0, "sla_compliant": False}
        distributor_degraded = RuntimeTaskDistributor(retrieval_stats_hook=degraded_hook)

        ranked_degraded = distributor_degraded.rank_workloads(tasks)
        # In degraded mode, Strategist must be boosted to top rank
        self.assertEqual(ranked_degraded[0][0].node_role, "STRATEGIST")

        # Worker score must be clamped down due to reduced weight (1.00 -> 0.80)
        worker_score_degraded = next(score for t, score, _ in ranked_degraded if t.task_id == "task_worker_burst")
        self.assertLess(worker_score_degraded, worker_score_nominal)

    def test_03_byzantine_quorum_consensus_under_adversarial_votes(self) -> None:
        """Verifies multi-agent consensus network handles Byzantine conflict, quorum weights, and auditor veto."""
        consensus = AutomatedConsensusNetwork(quorum_threshold=0.65, entropy_threshold=0.88)

        # 1. Nominal consensus reached (Strategist + Worker approve, Auditor approves)
        p1 = consensus.create_proposal("STATE_COMMIT", {"delta": 0.05}, "STRATEGIST")
        consensus.cast_vote(p1.proposal_id, "strat_0", "STRATEGIST", VoteDecision.APPROVE, 0.95)
        consensus.cast_vote(p1.proposal_id, "work_0", "WORKER", VoteDecision.APPROVE, 0.90)
        consensus.cast_vote(p1.proposal_id, "audit_0", "AUDITOR", VoteDecision.APPROVE, 0.92)

        res1 = consensus.resolve_consensus(p1.proposal_id, current_entropy=0.15)
        self.assertEqual(res1["status"], ConsensusStatus.CONSENSUS_REACHED.value)

        # 2. Byzantine conflict: Auditor issues veto on unverified mutation
        p2 = consensus.create_proposal("ARBITRARY_MUTATION", {"mem_override": True}, "WORKER")
        consensus.cast_vote(p2.proposal_id, "work_1", "WORKER", VoteDecision.APPROVE, 0.99)
        consensus.cast_vote(p2.proposal_id, "work_2", "WORKER", VoteDecision.APPROVE, 0.95)
        # Auditor rejects with high confidence
        consensus.cast_vote(p2.proposal_id, "audit_0", "AUDITOR", VoteDecision.REJECT, 0.95, "Security violation")

        res2 = consensus.resolve_consensus(p2.proposal_id, current_entropy=0.15)
        self.assertEqual(res2["status"], ConsensusStatus.AUDITOR_VETOED.value)

    def test_04_shannon_entropy_monitoring_and_loop_mitigation(self) -> None:
        """Verifies consensus network detects high entropy drift (H >= 0.88) and triggers rollback."""
        consensus = AutomatedConsensusNetwork(quorum_threshold=0.65, entropy_threshold=0.88)

        p = consensus.create_proposal("TEST_DRIFT", {}, "STRATEGIST")
        consensus.cast_vote(p.proposal_id, "strat_0", "STRATEGIST", VoteDecision.APPROVE, 0.95)

        # Trigger high-entropy breach (H = 0.92 >= 0.88)
        res = consensus.resolve_consensus(p.proposal_id, current_entropy=0.92)
        self.assertEqual(res["status"], ConsensusStatus.ENTROPY_VIOLATION.value)
        self.assertEqual(res["action"], "↺ ROLLBACK")


if __name__ == "__main__":
    unittest.main()
