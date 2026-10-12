"""
SarembokVE - Enterprise Architecture Comprehensive Acceptance Suite
Validates Phases 1 through 4:
- Phase 1: Zero-locking SQLite-WAL storage layer
- Phase 2: AAS gRPC scheduler interface & OpenTelemetry trace propagation
- Phase 3: Dual-Tier L1/L2 memory caching, HNSW search, stale demotion, & SKTB event bus
- Phase 4: Sandboxed Micro-VM isolation & Tamper-Evident SHA-256 Merkle audit chain
"""

from __future__ import annotations

import asyncio
import os
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from Runtime.aas_grpc_service import (
    AgentRole,
    AgentStatus,
    AutonomousAgentSchedulerService,
    ScheduleRequest,
    SchedulingPriority,
)
from Runtime.consensus_network import (
    AutomatedConsensusNetwork,
    ConsensusStatus,
    VoteDecision,
)
from Runtime.dual_tier_memory import DualTierMemoryRouter
from Runtime.sandbox_microvm import MicroVMSandboxScheduler, build_runsc_command
from Runtime.sarembok_telemetry import AgentTelemetryTracer
from Runtime.sktb_event_bus import (
    SecureKernelTelemetryBus,
    RedisClusterPoolManager,
    PRODUCTION_KAFKA_BROKERS,
    PRODUCTION_REDIS_ENDPOINTS,
)
from Runtime.tamper_evident_audit import TamperEvidentAuditLedger
from Runtime.wal_memory_manager import WalMemoryManager


class TestEnterpriseArchitecture(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.temp_audit_db = str(ROOT / "scratch" / "test_audit_ledger.db")
        os.makedirs(os.path.dirname(self.temp_audit_db), exist_ok=True)
        if os.path.exists(self.temp_audit_db):
            os.remove(self.temp_audit_db)

    def tearDown(self):
        if os.path.exists(self.temp_audit_db):
            os.remove(self.temp_audit_db)

    async def test_phase1_wal_memory_manager_actor_queue(self):
        """Verifies decoupled L1 SQLite-WAL actor queue handles async multi-agent writes without locks."""
        wal_manager = WalMemoryManager.get_instance(str(ROOT / "scratch" / "test_wal_actor.db"))
        
        # Fire 25 concurrent agent step writes
        tasks = []
        for i in range(25):
            tasks.append(
                wal_manager.record_step_async(
                    step_id=f"step_test_{i}",
                    agent_node=f"AGENT_{i}",
                    directive="Validate actor queue concurrency",
                    entropy=0.25,
                    status="COMPLETED",
                    wait_flush=True,
                )
            )
        await asyncio.gather(*tasks)

        history = wal_manager.get_agent_history("AGENT_0", limit=10)
        self.assertTrue(len(history) >= 1)
        self.assertEqual(history[0]["agent_node"], "AGENT_0")

    async def test_phase2_aas_scheduler_and_otel_tracing(self):
        """Verifies AAS time-slice scheduling and OpenTelemetry trace propagation."""
        aas = AutonomousAgentSchedulerService(max_entropy_threshold=0.88)
        
        # 1. Register Agent
        reg_res = await aas.register_agent(
            agent_id="STRATEGIST_01",
            role=AgentRole.STRATEGIST,
            capability_tags=["reasoning", "planning"],
        )
        self.assertTrue(reg_res["accepted"])
        self.assertTrue(len(reg_res["assigned_slice_id"]) > 0)

        # 2. OpenTelemetry Tracing
        tracer = AgentTelemetryTracer.get_tracer()
        with tracer.trace_agent_turn(
            agent_id="STRATEGIST_01",
            role="STRATEGIST",
            task_id="task_alpha",
        ) as span:
            self.assertTrue(len(span.trace_id) == 32)
            self.assertTrue(len(span.span_id) == 16)
            
            # 3. Request Schedule Slice with propagated trace context
            sched_req = ScheduleRequest(
                agent_id="STRATEGIST_01",
                task_id="task_alpha",
                priority=SchedulingPriority.REALTIME,
                requested_slice_quantum_ms=30,
                shannon_entropy=0.35,
                trace_id=span.trace_id,
                span_id=span.span_id,
            )
            sched_res = await aas.schedule_slice(sched_req)
            self.assertTrue(sched_res.granted)
            self.assertEqual(sched_res.status, AgentStatus.BUSY)
            self.assertLessEqual(sched_res.granted_quantum_ms, 50)

    def test_phase3_dual_tier_memory_and_sktb_event_bus(self):
        """Verifies L1 cache, L2 HNSW vector retrieval, automatic stale demotion, and SKTB Kafka publishing."""
        router = DualTierMemoryRouter(l1_ttl_seconds=0)  # Immediate expiry for demotion testing
        
        # 1. Store in L1
        router.store_agent_context(
            agent_id="AGENT_X",
            context_key="active_hypothesis",
            payload={"belief": "distributed consensus established", "confidence": 0.98},
        )
        
        # 2. Trigger auto-demotion to L2 HNSW
        demoted_count = router.trigger_stale_demotion()
        self.assertEqual(demoted_count, 1)

        # 3. Query L2 semantic memory
        results = router.query_semantic_long_term("consensus distributed", top_k=1)
        self.assertTrue(len(results) > 0)
        self.assertIn("demoted_", results[0]["doc_id"])

        # 4. SKTB Telemetry Bus publishing
        bus = SecureKernelTelemetryBus.get_bus()
        published = bus.publish_footprint_nowait(
            topic="agent-events",
            agent_id="AGENT_X",
            event_type="STATE_DEMOTED",
            details={"demoted_to": "L2_HNSW"},
        )
        self.assertTrue(published)

    async def test_phase4_microvm_sandbox_and_tamper_evident_audit(self):
        """Verifies isolated Micro-VM execution and tamper-evident SHA-256 Merkle audit chaining."""
        # 1. Micro-VM Sandbox Execution
        sandbox = MicroVMSandboxScheduler(runtime_flavor="container_isolated")
        result = await sandbox.execute_isolated_code(
            code_snippet="print('MICROVM_ISOLATED_OK: computed 42 * 2 =', 42 * 2)",
            language="python",
            agent_id="WORKER_SANDBOX",
            timeout=5.0,
        )
        self.assertEqual(result.exit_code, 0)
        self.assertIn("MICROVM_ISOLATED_OK: computed 42 * 2 = 84", result.stdout)

        # 2. Tamper-Evident Cryptographic Ledger
        ledger = TamperEvidentAuditLedger(db_path=self.temp_audit_db)
        b0 = ledger.record_mutation("STRATEGIST", "DISPATCH_TASK", {"task_id": "T001"})
        b1 = ledger.record_mutation("WORKER", "EXECUTE_MICRO_STEP", {"step": 1, "output": "pass"})
        b2 = ledger.record_mutation("AUDITOR", "SIGN_ATTESTATION", {"valid": True})

        self.assertEqual(b0.block_index, 0)
        self.assertEqual(b1.prev_hash, b0.block_hash)
        self.assertEqual(b2.prev_hash, b1.block_hash)

        # 3. Verify Chain Integrity
        is_valid, violations = ledger.verify_chain_integrity()
        self.assertTrue(is_valid, f"Violations detected: {violations}")
        self.assertEqual(len(violations), 0)

        # 4. SOC 2 Type II Report
        report = ledger.generate_soc2_compliance_report()
        self.assertEqual(report["system_status"], "COMPLIANT")
        self.assertEqual(report["total_audit_blocks"], 3)

    def test_phase3_retrieval_sla_target(self):
        """Verifies HNSW vector search clears the enterprise <45ms SLA under batch query load."""
        router = DualTierMemoryRouter()
        # Seed 50 contextual documents
        for i in range(50):
            router.l2_vector_index.insert(
                doc_id=f"doc_ctx_{i}",
                text=f"Agent context state knowledge item number {i} regarding distributed consensus and kernel scheduling",
                metadata={"index": i},
            )
        sla_report = router.verify_retrieval_sla(num_queries=20, max_latency_ms=45.0)
        self.assertTrue(sla_report["slaCompliant"], f"Failed SLA target: {sla_report}")
        self.assertLess(sla_report["p95LatencyMs"], 45.0)

    def test_phase5_automated_consensus_and_entropy_rollback(self):
        """Verifies Phase 4.0 Advanced Agent Evolution:
        - Quorum-weighted Byzantine voting (STRATEGIST, WORKER, AUDITOR)
        - Auditor absolute veto mechanism
        - Sliding-window Shannon entropy monitoring (<0.88 limit check)
        - Loop rollback state machine (↺ ROLLBACK) on non-deterministic drift.
        """
        acn = AutomatedConsensusNetwork(quorum_threshold=0.67, entropy_threshold=0.88)

        # 1. Normal Quorum Approval & Checkpoint Generation
        p1 = acn.create_proposal(
            action_type="EXECUTE_TOOL",
            payload={"tool": "bash", "command": "echo 'safe deploy'"},
            proposer_agent_id="STRATEGIST_01",
        )
        acn.cast_vote(p1.proposal_id, "STRATEGIST_01", "STRATEGIST", VoteDecision.APPROVE, confidence=1.0)
        acn.cast_vote(p1.proposal_id, "WORKER_01", "WORKER", VoteDecision.APPROVE, confidence=0.95)
        acn.cast_vote(p1.proposal_id, "AUDITOR_01", "AUDITOR", VoteDecision.APPROVE, confidence=1.0)

        res1 = acn.resolve_consensus(p1.proposal_id, current_entropy=0.22)
        self.assertEqual(res1["status"], ConsensusStatus.CONSENSUS_REACHED.value)
        self.assertGreaterEqual(res1["consensusRatio"], 0.67)
        self.assertEqual(acn.rollback_sm.current_state.get("last_committed_proposal"), p1.proposal_id)

        # 2. Auditor Veto Execution
        p2 = acn.create_proposal(
            action_type="MODIFY_SECURITY_POLICY",
            payload={"bypass_firecracker": True},
            proposer_agent_id="WORKER_02",
        )
        acn.cast_vote(p2.proposal_id, "STRATEGIST_01", "STRATEGIST", VoteDecision.APPROVE, confidence=0.8)
        acn.cast_vote(p2.proposal_id, "WORKER_02", "WORKER", VoteDecision.APPROVE, confidence=0.9)
        acn.cast_vote(
            p2.proposal_id,
            "AUDITOR_01",
            "AUDITOR",
            VoteDecision.REJECT,
            confidence=0.99,
            rationale="Unsafe sandbox bypass detected",
        )

        res2 = acn.resolve_consensus(p2.proposal_id, current_entropy=0.30)
        self.assertEqual(res2["status"], ConsensusStatus.AUDITOR_VETOED.value)
        self.assertEqual(res2["vetoBy"], "AUDITOR_01")

        # 3. Shannon Entropy Drift & ↺ ROLLBACK Trigger
        p3 = acn.create_proposal(
            action_type="HIGH_UNCERTAINTY_BRANCH",
            payload={"branch": "divergent"},
            proposer_agent_id="WORKER_01",
        )
        acn.cast_vote(p3.proposal_id, "WORKER_01", "WORKER", VoteDecision.APPROVE, confidence=0.5)

        # Inject severe entropy drift >= 0.88 to trigger rollback
        res3 = acn.resolve_consensus(p3.proposal_id, current_entropy=0.95)
        self.assertEqual(res3["status"], ConsensusStatus.ENTROPY_VIOLATION.value)
        self.assertEqual(res3["action"], "↺ ROLLBACK")
        self.assertGreaterEqual(res3["instantaneousEntropy"], 0.88)
        self.assertIsNotNone(res3["rollback"])

        # Check that state machine reverted back to last verified stable state (p1)
        restored = acn.rollback_sm.current_state
        self.assertEqual(restored.get("last_committed_proposal"), p1.proposal_id)

    def test_phase6_clustered_brokers_runsc_and_hnsw_latency_hooks(self):
        """Verifies Antigravity compute layer preparations:
        1. Clustered Kafka production brokers & Redis cluster connection pool.
        2. Active 'runsc' gVisor micro-kernel system call command generation.
        3. Real-time L2 HNSW retrieval latency telemetry hooks (p95 monitoring).
        """
        # 1. Clustered Kafka production brokers & Redis cluster pool
        bus = SecureKernelTelemetryBus.get_bus()
        self.assertTrue(len(bus.server_list) >= 1)
        for broker in ["kafka:9092", "localhost:9092"]:
            self.assertIn(broker, bus.server_list)
        self.assertTrue(any("sarembok.internal" in b for b in PRODUCTION_KAFKA_BROKERS))

        pool = RedisClusterPoolManager.get_pool()
        self.assertIsNotNone(pool)
        self.assertTrue(len(pool.endpoints) >= 1)
        self.assertIn("localhost:6379", pool.endpoints)

        # 2. Active runsc gVisor system call command generation
        runsc_cmd = build_runsc_command(
            runsc_bin="/usr/local/bin/runsc",
            script_path="/sandbox/workload.py",
            language="python",
            mem_limit_mb=512,
            cpu_limit=1.0,
        )
        self.assertEqual(runsc_cmd[0], "/usr/local/bin/runsc")
        self.assertIn("--network=none", runsc_cmd)
        self.assertIn("--rootless=true", runsc_cmd)
        self.assertIn("--platform=ptrace", runsc_cmd)
        self.assertIn("do", runsc_cmd)
        self.assertIn("python", runsc_cmd)
        self.assertIn("/sandbox/workload.py", runsc_cmd)

        # 3. Real-time L2 HNSW latency monitoring hooks & p95 statistics
        router = DualTierMemoryRouter()
        for i in range(10):
            router.l2.insert(f"hook_doc_{i}", f"kernel latency verification turn {i}", {"idx": i})

        # Execute queries to populate latency sliding window
        for i in range(5):
            router.query_semantic_long_term(f"verification turn {i}", top_k=2)

        stats = router.get_retrieval_stats()
        self.assertGreaterEqual(stats["sample_count"], 5)
        self.assertTrue(stats["sla_compliant"])
        self.assertLess(stats["p95_ms"], 45.0)


if __name__ == "__main__":
    unittest.main()


