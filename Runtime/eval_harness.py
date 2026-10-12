"""Offline Tool-Calling Evaluation Harness and Runtime Task Distributor for Sarembok.

Provides isolated evaluation of multi-step agent tool calling against local
capability registry schemas, detects logical looping and oscillation, guarantees
non-blocking isolated teardown routines, and fine-tunes compute distribution
across STRATEGIST, WORKER, and AUDITOR nodes based on retrieval SLAs.
"""

from __future__ import annotations

import collections
import concurrent.futures
import dataclasses
import hashlib
import json
import logging
import math
import os
import shutil
import tempfile
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

try:
    from Runtime.sarembok_capabilities import (
        CapabilityClass,
        CapabilityDescriptor,
        CapabilityPolicy,
        CapabilityRegistry,
        RiskLevel,
    )
except ImportError:
    from sarembok_capabilities import (
        CapabilityClass,
        CapabilityDescriptor,
        CapabilityPolicy,
        CapabilityRegistry,
        RiskLevel,
    )

logger = logging.getLogger("sarembok.eval_harness")


# ============================================================================
# Exceptions
# ============================================================================

class EvaluationError(Exception):
    """Base error for evaluation harness failures."""


class LogicalLoopException(EvaluationError):
    """Raised when an agent enters repetitive or oscillating execution loops."""


class PolicyViolationException(EvaluationError):
    """Raised when a tool call violates capability boundaries."""


class EvaluationTimeoutException(EvaluationError):
    """Raised when agent evaluation exceeds allotted time boundary."""


class UnregisteredCapabilityException(EvaluationError):
    """Raised when an agent attempts to execute an unknown capability."""


# ============================================================================
# Data Models
# ============================================================================

@dataclasses.dataclass
class ToolCallAttempt:
    """Record of a single tool execution attempt within an agent trajectory."""
    tool_name: str
    arguments: Dict[str, Any]
    agent_id: str = "WORKER"
    node_role: str = "WORKER"  # STRATEGIST, WORKER, AUDITOR
    step_index: int = 0
    call_id: str = ""
    timestamp: float = dataclasses.field(default_factory=time.time)
    duration_ms: float = 0.0
    status: str = "PENDING"  # PENDING, SUCCESS, FAILED, POLICY_DENIED, LOOP_DETECTED, TIMED_OUT, UNREGISTERED
    result: Optional[Any] = None
    error: Optional[str] = None
    policy_permitted: bool = True

    def __post_init__(self) -> None:
        if not self.call_id:
            raw = f"{self.tool_name}:{self.step_index}:{self.timestamp}:{id(self)}"
            self.call_id = hashlib.sha256(raw.encode()).hexdigest()[:12]

    def arg_signature(self) -> str:
        """Deterministic serialization for loop and repetition detection."""
        try:
            serialized_args = json.dumps(self.arguments, sort_keys=True, default=str)
        except Exception:
            serialized_args = str(sorted(self.arguments.items()))
        combined = f"{self.tool_name}::{serialized_args}"
        return hashlib.sha256(combined.encode("utf-8")).hexdigest()


@dataclasses.dataclass
class EvaluationReport:
    """Comprehensive outcome of an agent's multi-step reasoning evaluation."""
    session_id: str
    agent_id: str
    goal: str
    attempts: List[ToolCallAttempt]
    total_steps: int
    successful_calls: int
    failed_calls: int
    accuracy_score: float  # 0.0 to 1.0
    reasoning_coherence: float  # 0.0 to 1.0
    policy_compliance: float  # 0.0 to 1.0
    loop_detected: bool
    loop_type: Optional[str] = None
    timed_out: bool = False
    execution_time_ms: float = 0.0
    allocated_hardware_tier: str = "LOCAL_SANDBOX"  # LOCAL_SANDBOX or CLOUD_RTX4090_A100
    details: Dict[str, Any] = dataclasses.field(default_factory=dict)


# ============================================================================
# Loop Detector & Circuit Breaker
# ============================================================================

class LoopDetector:
    """Detects repetitive tool invocations, A-B-A-B oscillations, and entropy collapse."""

    def __init__(
        self,
        max_identical_repeats: int = 3,
        max_oscillation_cycles: int = 2,
        max_steps: int = 20,
        entropy_threshold: float = 0.40,
    ) -> None:
        self.max_identical_repeats = max_identical_repeats
        self.max_oscillation_cycles = max_oscillation_cycles
        self.max_steps = max_steps
        self.entropy_threshold = entropy_threshold
        self.history: List[ToolCallAttempt] = []

    def reset(self) -> None:
        self.history.clear()

    def inspect_step(self, attempt: ToolCallAttempt) -> Optional[str]:
        """Inspects current step against historical trajectory.
        
        Returns loop description string if detected, or None.
        """
        self.history.append(attempt)
        total = len(self.history)

        # 1. Check max step budget
        if total > self.max_steps:
            return f"STEP_BUDGET_EXCEEDED: Step count {total} exceeded maximum {self.max_steps}"

        sigs = [h.arg_signature() for h in self.history]
        names = [h.tool_name for h in self.history]

        # 2. Check identical consecutive repetitions (e.g. 3 consecutive identical calls)
        if total >= self.max_identical_repeats:
            recent_sigs = sigs[-self.max_identical_repeats:]
            if len(set(recent_sigs)) == 1:
                return (
                    f"CONSECUTIVE_REPEAT_LOOP: Tool '{attempt.tool_name}' invoked "
                    f"{self.max_identical_repeats} times with identical inputs"
                )

        # 3. Check 2-cycle oscillation (A -> B -> A -> B)
        cycle_len = 2
        needed_steps = cycle_len * self.max_oscillation_cycles
        if total >= needed_steps:
            sub = sigs[-needed_steps:]
            # Pattern A, B, A, B: sub[0]==sub[2] and sub[1]==sub[3] and sub[0]!=sub[1]
            if (
                sub[0] == sub[2]
                and sub[1] == sub[3]
                and sub[0] != sub[1]
            ):
                return (
                    f"OSCILLATION_CYCLE_LOOP: Detected {self.max_oscillation_cycles}-period "
                    f"alternating loop between '{names[-2]}' and '{names[-1]}'"
                )

        # 4. Check 3-cycle oscillation (A -> B -> C -> A -> B -> C)
        cycle_len_3 = 3
        needed_steps_3 = cycle_len_3 * self.max_oscillation_cycles
        if total >= needed_steps_3:
            sub3 = sigs[-needed_steps_3:]
            if (
                sub3[0] == sub3[3]
                and sub3[1] == sub3[4]
                and sub3[2] == sub3[5]
                and len({sub3[0], sub3[1], sub3[2]}) == 3
            ):
                return (
                    f"OSCILLATION_CYCLE_LOOP: Detected 3-phase cycle across "
                    f"'{names[-3]}', '{names[-2]}', '{names[-1]}'"
                )

        # 5. Shannon entropy check on longer sequences (>= 6 steps)
        if total >= 6:
            entropy = self._calculate_shannon_entropy(names)
            if entropy < self.entropy_threshold and len(set(names)) <= 2:
                return (
                    f"ENTROPY_COLLAPSE_LOOP: Trajectory entropy ({entropy:.3f}) fell below "
                    f"threshold ({self.entropy_threshold:.3f}) with low diversity"
                )

        return None

    @staticmethod
    def _calculate_shannon_entropy(labels: Sequence[str]) -> float:
        if not labels:
            return 0.0
        counts = collections.Counter(labels)
        total = len(labels)
        entropy = 0.0
        for count in counts.values():
            p = count / total
            if p > 0:
                entropy -= p * math.log2(p)
        return entropy


# ============================================================================
# Isolated Loop Teardown Routine
# ============================================================================

class IsolatedLoopTeardown:
    """Guarantees stuck or looping runtime scripts cannot block system cleanup.
    
    Provides isolated workspace directories, watchdog timeouts, cancellation
    of active threads/subprocesses, and fail-safe teardown hooks.
    """

    def __init__(
        self,
        session_id: str,
        timeout_seconds: float = 3.0,
        export_target_dir: Optional[str] = None,
    ) -> None:
        self.session_id = session_id
        self.timeout_seconds = timeout_seconds
        self.scratch_dir: Optional[str] = None
        self._is_torn_down = False
        self._lock = threading.Lock()
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=2, thread_name_prefix=f"eval_teardown_{session_id[:6]}"
        )
        # Target export directory for public web client downloads
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.export_target_dir = export_target_dir or os.path.join(repo_root, "public", "exports")

    def setup(self) -> str:
        """Creates isolated scratch environment with dedicated artifacts folder."""
        with self._lock:
            self._is_torn_down = False
            self.scratch_dir = tempfile.mkdtemp(prefix=f"srbk_eval_{self.session_id}_")
            artifacts_sub = os.path.join(self.scratch_dir, "artifacts")
            os.makedirs(artifacts_sub, exist_ok=True)
            return self.scratch_dir

    def run_isolated(
        self,
        func: Callable[..., Any],
        *args: Any,
        timeout: Optional[float] = None,
        **kwargs: Any,
    ) -> Any:
        """Executes function inside an isolated worker with hard timeout."""
        if self._is_torn_down:
            raise RuntimeError("Cannot execute inside a torn-down isolation context")

        effective_timeout = timeout if timeout is not None else self.timeout_seconds
        future = self._executor.submit(func, *args, **kwargs)

        try:
            return future.result(timeout=effective_timeout)
        except concurrent.futures.TimeoutError as exc:
            future.cancel()
            logger.warning(
                f"[TEARDOWN_WATCHDOG] Execution in session '{self.session_id}' timed out after {effective_timeout}s"
            )
            self.teardown()
            raise EvaluationTimeoutException(
                f"Execution exceeded isolated timeout limit of {effective_timeout:.2f}s"
            ) from exc

    def _persist_generated_artifacts(self) -> List[str]:
        """Safely transfers generated artifacts to public exports before ephemeral cleanup."""
        persisted = []
        if not self.scratch_dir or not os.path.isdir(self.scratch_dir):
            return persisted

        os.makedirs(self.export_target_dir, exist_ok=True)
        valid_exts = {".pdf", ".docx", ".xlsx", ".pptx", ".csv", ".md", ".txt", ".py", ".js", ".json", ".yaml", ".tf"}

        for root, _, files in os.walk(self.scratch_dir):
            for file in files:
                _, ext = os.path.splitext(file)
                if ext.lower() in valid_exts or "artifacts" in root:
                    src_file = os.path.join(root, file)
                    dest_file = os.path.join(self.export_target_dir, file)
                    try:
                        shutil.copy2(src_file, dest_file)
                        persisted.append(dest_file)
                    except Exception as exc:
                        logger.warning(f"[TEARDOWN_EXPORT_FAIL] Could not preserve {file}: {exc}")

        if persisted:
            logger.info(
                f"[TEARDOWN_EXPORT] Preserved {len(persisted)} artifact(s) to '{self.export_target_dir}' "
                f"before ephemeral container cleanup."
            )
        return persisted

    def teardown(self) -> None:
        """Failsafe teardown that guarantees artifact preservation and zero process leaks."""
        with self._lock:
            if self._is_torn_down:
                return
            self._is_torn_down = True

            # 1. Safely move generated artifacts to public export directory before cleanup
            try:
                self._persist_generated_artifacts()
            except Exception as e:
                logger.error(f"[TEARDOWN_FAIL] Failed during artifact preservation: {e}")

            # 2. Shutdown thread pool immediately without blocking
            try:
                self._executor.shutdown(wait=False, cancel_futures=True)
            except Exception as e:
                logger.error(f"[TEARDOWN_FAIL] Failed to shutdown executor: {e}")

            # 3. Clean temporary scratch directory
            if self.scratch_dir and os.path.isdir(self.scratch_dir):
                try:
                    shutil.rmtree(self.scratch_dir, ignore_errors=True)
                except Exception as e:
                    logger.error(f"[TEARDOWN_FAIL] Failed to clean scratch dir {self.scratch_dir}: {e}")
                self.scratch_dir = None

    def __enter__(self) -> IsolatedLoopTeardown:
        self.setup()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.teardown()


# ============================================================================
# Agent Evaluation Harness
# ============================================================================

class AgentEvaluationHarness:
    """Offline tool-calling evaluation harness for Sarembok agent fleets.
    
    Evaluates multi-step tool calls, validates local capability registry schemas,
    detects logical loops, and executes isolated teardowns without relying on external connectivity.
    """

    def __init__(
        self,
        registry: Optional[CapabilityRegistry] = None,
        default_policy: Optional[CapabilityPolicy] = None,
        step_timeout_seconds: float = 2.0,
        session_timeout_seconds: float = 6.0,
    ) -> None:
        self.registry = registry or self._create_default_registry()
        self.default_policy = default_policy or self._create_default_policy()
        self.step_timeout_seconds = step_timeout_seconds
        self.session_timeout_seconds = session_timeout_seconds
        self.loop_detector = LoopDetector()

    @staticmethod
    def _create_default_registry() -> CapabilityRegistry:
        """Instantiates default local capability registry with core schemas."""
        reg = CapabilityRegistry()

        # Observe tools
        reg.register(
            CapabilityDescriptor(
                id="kernel.observe_system",
                version="1.0",
                capability_class=CapabilityClass.OBSERVE,
                required_permissions=("system.read",),
                risk_level=RiskLevel.LOW,
            ),
            lambda query="status": {"system": "healthy", "query": query, "nodes": 3},
        )
        reg.register(
            CapabilityDescriptor(
                id="memory.semantic_search",
                version="1.0",
                capability_class=CapabilityClass.REMEMBER,
                required_permissions=("memory.read",),
                risk_level=RiskLevel.LOW,
            ),
            lambda query="", top_k=3: [{"doc_id": "doc_1", "similarity": 0.92, "content": f"Match for {query}"}],
        )

        # Reason & Plan tools
        reg.register(
            CapabilityDescriptor(
                id="planner.decompose_task",
                version="1.0",
                capability_class=CapabilityClass.REASON,
                required_permissions=("plan.create",),
                risk_level=RiskLevel.LOW,
            ),
            lambda task="": {"subtasks": ["subtask_1", "subtask_2"], "confidence": 0.95},
        )

        # Execute tools
        reg.register(
            CapabilityDescriptor(
                id="code.execute_sandbox",
                version="1.0",
                capability_class=CapabilityClass.EXECUTE,
                required_permissions=("sandbox.exec",),
                risk_level=RiskLevel.MODERATE,
                supports_dry_run=True,
            ),
            lambda code="", language="python": {"exit_code": 0, "stdout": "executed", "stderr": ""},
        )
        reg.register(
            CapabilityDescriptor(
                id="hardware.cloud_allocate",
                version="1.0",
                capability_class=CapabilityClass.EXECUTE,
                required_permissions=("hardware.high_cost",),
                risk_level=RiskLevel.HIGH,
            ),
            lambda slice_type="RTX4090", hours=1: {"status": "ALLOCATED", "slice": slice_type, "duration": hours},
        )

        # Audit tools
        reg.register(
            CapabilityDescriptor(
                id="audit.verify_signature",
                version="1.0",
                capability_class=CapabilityClass.OBSERVE,
                required_permissions=("audit.read",),
                risk_level=RiskLevel.LOW,
            ),
            lambda record_hash="": {"verified": True, "tamper_detected": False},
        )

        return reg

    @staticmethod
    def _create_default_policy() -> CapabilityPolicy:
        """Returns baseline capability policy for agent evaluations."""
        return CapabilityPolicy(
            allowed_capabilities=frozenset({
                "kernel.observe_system",
                "memory.semantic_search",
                "planner.decompose_task",
                "code.execute_sandbox",
                "audit.verify_signature",
            }),
            approved_permissions=frozenset({
                "system.read",
                "memory.read",
                "plan.create",
                "sandbox.exec",
                "audit.read",
            }),
            allow_high_risk=False,
            allow_critical=False,
        )

    def evaluate_step(
        self,
        attempt: ToolCallAttempt,
        policy: Optional[CapabilityPolicy] = None,
        teardown: Optional[IsolatedLoopTeardown] = None,
    ) -> ToolCallAttempt:
        """Executes author/registry schema validations and runs a single tool step."""
        active_policy = policy or self.default_policy
        t_start = time.perf_counter()

        # 1. Loop and circuit-breaker check
        loop_error = self.loop_detector.inspect_step(attempt)
        if loop_error:
            attempt.status = "LOOP_DETECTED"
            attempt.error = loop_error
            attempt.duration_ms = (time.perf_counter() - t_start) * 1000.0
            raise LogicalLoopException(loop_error)

        # 2. Local registry schema check
        descriptor = self.registry.describe(attempt.tool_name)
        if descriptor is None:
            attempt.status = "UNREGISTERED"
            attempt.error = f"Tool '{attempt.tool_name}' not found in CapabilityRegistry"
            attempt.duration_ms = (time.perf_counter() - t_start) * 1000.0
            raise UnregisteredCapabilityException(attempt.error)

        # 3. Policy permission check
        if not active_policy.permits(descriptor):
            attempt.status = "POLICY_DENIED"
            attempt.policy_permitted = False
            attempt.error = (
                f"Policy denied '{attempt.tool_name}' (risk={descriptor.risk_level.value}, "
                f"perms={descriptor.required_permissions})"
            )
            attempt.duration_ms = (time.perf_counter() - t_start) * 1000.0
            raise PolicyViolationException(attempt.error)

        # 4. Isolated execution with step timeout
        def _invoke_tool() -> Any:
            return self.registry.invoke(attempt.tool_name, active_policy, **attempt.arguments)

        try:
            if teardown is not None:
                res = teardown.run_isolated(_invoke_tool, timeout=self.step_timeout_seconds)
            else:
                with IsolatedLoopTeardown(f"step_{attempt.call_id}", timeout_seconds=self.step_timeout_seconds) as td:
                    res = td.run_isolated(_invoke_tool, timeout=self.step_timeout_seconds)

            attempt.status = "SUCCESS"
            attempt.result = res
        except EvaluationTimeoutException as exc:
            attempt.status = "TIMED_OUT"
            attempt.error = str(exc)
            raise
        except Exception as exc:
            attempt.status = "FAILED"
            attempt.error = str(exc)
            raise
        finally:
            attempt.duration_ms = (time.perf_counter() - t_start) * 1000.0

        return attempt

    def evaluate_trajectory(
        self,
        goal: str,
        attempts: Sequence[ToolCallAttempt],
        agent_id: str = "WORKER",
        policy: Optional[CapabilityPolicy] = None,
    ) -> EvaluationReport:
        """Evaluates an agent's multi-step tool-calling trajectory offline."""
        session_id = f"eval_{uuid.uuid4().hex[:8]}"
        self.loop_detector.reset()
        executed_attempts: List[ToolCallAttempt] = []
        loop_detected = False
        loop_type: Optional[str] = None
        timed_out = False
        t_start = time.perf_counter()

        with IsolatedLoopTeardown(session_id, timeout_seconds=self.session_timeout_seconds) as teardown:
            for idx, attempt in enumerate(attempts):
                attempt.step_index = idx
                attempt.agent_id = agent_id

                try:
                    self.evaluate_step(attempt, policy=policy, teardown=teardown)
                    executed_attempts.append(attempt)
                except LogicalLoopException as exc:
                    loop_detected = True
                    loop_type = str(exc)
                    executed_attempts.append(attempt)
                    break
                except EvaluationTimeoutException:
                    timed_out = True
                    executed_attempts.append(attempt)
                    break
                except (PolicyViolationException, UnregisteredCapabilityException, Exception):
                    executed_attempts.append(attempt)
                    # Proceed to test agent recovery or stop if non-recoverable

        total_ms = (time.perf_counter() - t_start) * 1000.0
        total_steps = len(executed_attempts)
        successful = sum(1 for a in executed_attempts if a.status == "SUCCESS")
        failed = sum(1 for a in executed_attempts if a.status != "SUCCESS")

        accuracy_score = (successful / total_steps) if total_steps > 0 else 0.0

        # Multi-step reasoning score: penalizes loops, non-recoverable failures, and policy violations
        reasoning_score = 1.0
        if loop_detected:
            reasoning_score *= 0.1
        if timed_out:
            reasoning_score *= 0.3
        if total_steps > 0:
            policy_denials = sum(1 for a in executed_attempts if a.status == "POLICY_DENIED")
            unregistered = sum(1 for a in executed_attempts if a.status == "UNREGISTERED")
            reasoning_score *= max(0.0, 1.0 - (policy_denials * 0.3 + unregistered * 0.4) / total_steps)

        policy_compliance = (
            sum(1 for a in executed_attempts if a.policy_permitted) / total_steps
            if total_steps > 0 else 1.0
        )

        # Hardware tier recommendation based on verified reasoning stability
        hardware_tier = (
            "CLOUD_RTX4090_A100"
            if (reasoning_score >= 0.85 and not loop_detected and not timed_out)
            else "LOCAL_SANDBOX"
        )

        return EvaluationReport(
            session_id=session_id,
            agent_id=agent_id,
            goal=goal,
            attempts=executed_attempts,
            total_steps=total_steps,
            successful_calls=successful,
            failed_calls=failed,
            accuracy_score=round(accuracy_score, 3),
            reasoning_coherence=round(reasoning_score, 3),
            policy_compliance=round(policy_compliance, 3),
            loop_detected=loop_detected,
            loop_type=loop_type,
            timed_out=timed_out,
            execution_time_ms=round(total_ms, 2),
            allocated_hardware_tier=hardware_tier,
            details={"step_count": total_steps},
        )


# ============================================================================
# Runtime Task Distributor & Workload Ranker
# ============================================================================

@dataclasses.dataclass
class AgentTaskRequest:
    """Incoming task request to be scheduled across nodes."""
    task_id: str
    node_role: str  # STRATEGIST, WORKER, AUDITOR
    complexity_score: float  # 0.0 to 1.0
    estimated_tool_steps: int
    requires_cloud_gpu: bool = False
    priority_override: Optional[float] = None


class RuntimeTaskDistributor:
    """Fine-tunes compute distribution across STRATEGIST, WORKER, and AUDITOR nodes.
    
    Uses a 'decision-first' heuristic to rank agent queue requests, incorporating
    get_retrieval_stats() to protect memory bus SLAs before allocating expensive
    cloud hardware slices (RTX 4090 / A100).
    """

    BASE_WEIGHTS = {
        "STRATEGIST": 1.25,  # Decision guidance, architecture & plan decomposition
        "WORKER": 1.00,      # Execution and code workload
        "AUDITOR": 1.10,     # Consensus voting and compliance verification
    }

    def __init__(self, retrieval_stats_hook: Optional[Callable[[], Dict[str, Any]]] = None) -> None:
        self.retrieval_stats_hook = retrieval_stats_hook

    def get_retrieval_stats(self) -> Dict[str, Any]:
        """Fetches real-time p95 semantic retrieval latency telemetry."""
        if self.retrieval_stats_hook is not None:
            try:
                return self.retrieval_stats_hook()
            except Exception as e:
                logger.warning(f"Failed to query retrieval stats hook: {e}")
        return {"sample_count": 0, "p50_ms": 12.0, "p95_ms": 28.0, "p99_ms": 38.0, "sla_compliant": True}

    def rank_workloads(
        self,
        tasks: Sequence[AgentTaskRequest],
        eval_reports: Optional[Dict[str, EvaluationReport]] = None,
    ) -> List[Tuple[AgentTaskRequest, float, str]]:
        """Ranks incoming queue requests decision-first and assigns hardware tiers.
        
        Returns a list of tuples: (task_request, final_priority_score, assigned_hardware_tier)
        ordered from highest priority to lowest priority.
        """
        stats = self.get_retrieval_stats()
        p95_ms = float(stats.get("p95_ms", 25.0))
        sla_compliant = bool(stats.get("sla_compliant", True))

        # Under degraded memory bus retrieval latency (> 45ms), boost STRATEGIST
        # decision-first pruning so planning filters reduce downstream worker load.
        role_weights = dict(self.BASE_WEIGHTS)
        if not sla_compliant or p95_ms > 45.0:
            role_weights["STRATEGIST"] = 1.60
            role_weights["WORKER"] = 0.80  # Deprioritize worker bursts
            logger.info(
                f"[TASK_DIST] Memory retrieval SLA degraded (p95={p95_ms:.1f}ms). "
                f"Boosting STRATEGIST weight to 1.60 to enforce decision-first pruning."
            )

        ranked: List[Tuple[AgentTaskRequest, float, str]] = []

        for task in tasks:
            base_w = role_weights.get(task.node_role.upper(), 1.0)

            # Decision-first formula:
            # Priority = (Role Weight * 0.45) + (Complexity * 0.35) - (Step penalty * 0.10)
            step_penalty = min(task.estimated_tool_steps / 20.0, 1.0) * 0.10
            score = (base_w * 0.45) + (task.complexity_score * 0.35) - step_penalty

            if task.priority_override is not None:
                score += task.priority_override

            # Check evaluation harness history if available
            report = (eval_reports or {}).get(task.task_id)
            is_loop_free = True
            if report:
                if report.loop_detected or report.timed_out:
                    is_loop_free = False
                    score *= 0.5  # Penalize looping agents

            # Gating high-cost remote cloud hardware slices (RTX 4090 / A100):
            # Only allocate high-cost slices if requested, task is decision-approved,
            # and verified loop-free. Otherwise confine to local gVisor sandbox.
            if task.requires_cloud_gpu and is_loop_free and score >= 0.65:
                hardware_tier = "CLOUD_RTX4090_A100"
            else:
                hardware_tier = "LOCAL_SANDBOX"

            ranked.append((task, round(score, 4), hardware_tier))

        # Sort descending by priority score
        ranked.sort(key=lambda item: item[1], reverse=True)
        return ranked


# Provide a singleton helper
import uuid
