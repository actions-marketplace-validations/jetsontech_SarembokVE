# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""Unit and Integration Tests for SarembokVE Enterprise Hardening Spec.

Verifies:
1. Context Virtual Page Fault Engine & Virtual Memory Swapping (<15ms resolution).
2. Stateless Unikernel compilation (<5MB) and hypervisor controller execution.
3. Clustered Kafka Tensor Core utilization & p99 compute metrics streaming.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
import time
import unittest

from Runtime.dual_tier_memory import (
    ContextPageFaultEngine,
    ContextVirtualPage,
    DualTierMemoryRouter,
    EphemeralL1Cache,
    HNSWVectorIndex,
)
from Runtime.sandbox_microvm import (
    MicroVMSandboxScheduler,
    StatelessUnikernelCompiler,
    UnikernelArtifact,
)
from Runtime.sktb_event_bus import SecureKernelTelemetryBus


class TestEnterpriseHardeningSpec(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.test_dir = tempfile.mkdtemp(prefix="srbk_silicon_test_")
        self.router = DualTierMemoryRouter(l1_ttl_seconds=30)
        self.bus = SecureKernelTelemetryBus.get_bus()

    def tearDown(self) -> None:
        if os.path.isdir(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_01_context_virtual_memory_allocation_and_lru_swap(self) -> None:
        """Verifies VMM allocates pages and swaps out to L2 when capacity limit is reached."""
        engine = ContextPageFaultEngine(
            l1_cache=self.router.l1,
            l2_index=self.router.l2,
            max_active_pages_per_pid=3,  # Strict small budget to test LRU swap
        )

        pid = "agent_strategist_01"

        # Allocate 3 pages (fills L1 working set)
        p1 = engine.allocate_page(pid, "page_01", {"state": "boot_plan", "step": 1})
        p2 = engine.allocate_page(pid, "page_02", {"state": "tool_inspect", "step": 2})
        p3 = engine.allocate_page(pid, "page_03", {"state": "consensus_vote", "step": 3})

        self.assertEqual(p1.page_state, "ACTIVE_L1")
        self.assertEqual(p2.page_state, "ACTIVE_L1")
        self.assertEqual(p3.page_state, "ACTIVE_L1")

        # Allocating 4th page forces LRU swap out of page_01 to L2 HNSW
        time.sleep(0.01)
        p4 = engine.allocate_page(pid, "page_04", {"state": "execution_run", "step": 4})

        stats = engine.get_paging_stats()
        self.assertEqual(stats["active_l1_pages"], 3)
        self.assertEqual(stats["swapped_l2_pages"], 1)
        self.assertEqual(stats["swap_out_count"], 1)
        self.assertEqual(p1.page_state, "SWAPPED_L2")

    def test_02_context_page_fault_resolution_under_15ms(self) -> None:
        """Verifies referencing a swapped page trips Context Page Fault and repages in <15ms."""
        engine = ContextPageFaultEngine(
            l1_cache=self.router.l1,
            l2_index=self.router.l2,
            max_active_pages_per_pid=2,
        )

        pid = "agent_worker_42"
        # Allocate page 1 and page 2
        p1 = engine.allocate_page(pid, "arch_spec", {"blueprint": "frontier_v5", "version": 5})
        time.sleep(0.01)
        p2 = engine.allocate_page(pid, "audit_hash", {"merkle_root": "0xabc", "verified": True})

        # Allocate page 3 -> causes arch_spec (page 1) to be paged out to L2 HNSW
        time.sleep(0.01)
        p3 = engine.allocate_page(pid, "eval_report", {"accuracy": 1.0, "loops": 0})
        self.assertEqual(p1.page_state, "SWAPPED_L2")

        # Access page 1: TRIPS CONTEXT PAGE FAULT!
        t0 = time.perf_counter()
        restored_page, fault_occurred = engine.access_page(pid, "arch_spec")
        resolution_ms = (time.perf_counter() - t0) * 1000.0

        self.assertTrue(fault_occurred, "Accessing swapped page must trigger Context Page Fault")
        self.assertEqual(restored_page.page_state, "ACTIVE_L1")
        self.assertEqual(restored_page.data["blueprint"], "frontier_v5")
        self.assertLess(resolution_ms, 15.0, f"Page fault resolution {resolution_ms:.2f}ms exceeded 15ms SLA")

        stats = engine.get_paging_stats()
        self.assertEqual(stats["page_fault_count"], 1)
        self.assertEqual(stats["swap_in_count"], 1)
        self.assertTrue(stats["sla_compliant"])

    def test_03_swap_idle_processes_and_router_integration(self) -> None:
        """Verifies swapping idle agent processes out to L2 memory arrays."""
        p = self.router.allocate_virtual_page("agent_auditor", "audit_trail", {"signatures": 12})
        self.assertEqual(p.page_state, "ACTIVE_L1")

        # Swap idle pages with 0 threshold
        swapped = self.router.swap_idle_virtual_memory(idle_threshold_seconds=0.0)
        self.assertGreaterEqual(swapped, 1)

        vmm_stats = self.router.get_virtual_memory_stats()
        self.assertEqual(vmm_stats["swapped_l2_pages"], 1)

        # Accessing restored page clears page fault seamlessly
        restored, fault = self.router.access_virtual_page("agent_auditor", "audit_trail")
        self.assertTrue(fault)
        self.assertEqual(restored.data["signatures"], 12)

    def test_04_stateless_unikernel_compilation_under_5mb(self) -> None:
        """Verifies compiler builds an immutable unikernel binary < 5MB with SHA-256 digest."""
        compiler = StatelessUnikernelCompiler(target_hypervisor="firecracker")
        code = "print('Unikernel initialized on naked hypervisor')\n"

        artifact = compiler.compile_unikernel(
            code_snippet=code,
            language="python",
            agent_id="STRATEGIST",
            output_dir=self.test_dir,
        )

        self.assertIsInstance(artifact, UnikernelArtifact)
        self.assertLess(artifact.binary_size_bytes, 5 * 1024 * 1024, "Unikernel binary must be strictly < 5MB")
        self.assertTrue(os.path.isfile(artifact.image_path))
        self.assertEqual(len(artifact.sha256_digest), 64)
        self.assertEqual(artifact.hypervisor_target, "firecracker")
        self.assertLess(artifact.compilation_time_ms, 15.0)

    async def test_05_stateless_unikernel_execution_and_self_destruction(self) -> None:
        """Verifies unikernel execution and instant self-destruction of hardware slice."""
        scheduler = MicroVMSandboxScheduler(runtime_flavor="unikernel")
        code = "print('PAYLOAD_UNIKERNEL_OUTPUT_OK')\n"

        res = await scheduler.compile_and_run_unikernel(
            code_snippet=code,
            language="python",
            agent_id="WORKER",
            timeout=2.0,
        )

        self.assertEqual(res.exit_code, 0)
        self.assertIn("PAYLOAD_UNIKERNEL_OUTPUT_OK", res.stdout)
        self.assertTrue(res.isolation_enforced)
        self.assertIn("unikernel", res.sandboxed_runtime)

    def test_06_live_tensor_core_utilization_streaming(self) -> None:
        """Verifies streaming real-time NVIDIA/custom silicon Tensor Core metrics to Kafka."""
        ok = self.bus.emit_tensor_utilization(
            node_id="nv_rtx4090_node_01",
            gpu_model="NVIDIA GeForce RTX 4090",
            tensor_core_utilization_pct=88.5,
            vram_allocated_mb=18432.0,
            vram_total_mb=24576.0,
            tensor_precision="BF16",
            active_streams=4,
            memory_bandwidth_pct=92.1,
        )
        self.assertTrue(ok)

        # Read back from live metrics cache
        metrics = self.bus.get_latest_tensor_metrics("nv_rtx4090_node_01")
        self.assertEqual(metrics["gpu_model"], "NVIDIA GeForce RTX 4090")
        self.assertEqual(metrics["tensor_core_utilization_pct"], 88.5)
        self.assertEqual(metrics["tensor_precision"], "BF16")
        self.assertEqual(metrics["active_streams"], 4)

    def test_07_compute_p99_metrics_streaming(self) -> None:
        """Verifies streaming p50/p95/p99 compute SLA metrics to Kafka."""
        ok = self.bus.emit_compute_p99_metrics(
            node_role="STRATEGIST",
            p50_ms=10.5,
            p95_ms=22.3,
            p99_ms=38.1,
            target_sla_ms=45.0,
            queue_depth=2,
        )
        self.assertTrue(ok)

        metrics = self.bus.get_latest_compute_sla_metrics("STRATEGIST")
        self.assertEqual(metrics["node_role"], "STRATEGIST")
        self.assertEqual(metrics["p99_latency_ms"], 38.1)
        self.assertTrue(metrics["sla_compliant"])


if __name__ == "__main__":
    unittest.main()
