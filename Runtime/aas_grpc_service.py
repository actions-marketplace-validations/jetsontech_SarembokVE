# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""
SarembokVE - Autonomous Agent Scheduler (AAS) Service Interface
Implements bidirectional streaming coordination logic, time-slice scheduling,
and low-latency message routing for the 25 active agent loops.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncIterator, Dict, List, Optional

logger = logging.getLogger("sarembok.aas")


class AgentRole(str, Enum):
    STRATEGIST = "STRATEGIST"
    WORKER = "WORKER"
    AUDITOR = "AUDITOR"
    KERNEL_GUARDRAIL = "KERNEL_GUARDRAIL"


class AgentStatus(str, Enum):
    IDLE = "IDLE"
    BUSY = "BUSY"
    FROZEN = "FROZEN"
    HALTED = "HALTED"


class SchedulingPriority(int, Enum):
    REALTIME = 1
    STANDARD = 2
    BATCH = 3


@dataclass
class AgentRegistration:
    agent_id: str
    role: AgentRole
    capability_tags: List[str]
    assigned_slice_id: str
    registered_at: float
    last_heartbeat: float = field(default_factory=time.time)
    status: AgentStatus = AgentStatus.IDLE


@dataclass
class ScheduleRequest:
    agent_id: str
    task_id: str
    priority: SchedulingPriority
    requested_slice_quantum_ms: int
    shannon_entropy: float = 0.0
    tokens_requested: int = 0
    trace_id: str = ""
    span_id: str = ""
    sequence_number: int = 0


@dataclass
class ScheduleResponse:
    agent_id: str
    slice_id: str
    granted: bool
    granted_quantum_ms: int
    status: AgentStatus
    reason: str
    sequence_number: int
    server_timestamp_ns: int


@dataclass
class PayloadEnvelope:
    message_id: str
    session_id: str
    sender_agent_id: str
    recipient_agent_id: str
    payload: bytes
    content_type: str = "application/json"
    tokens_consumed: int = 0
    entropy_score: float = 0.0
    validation_hash: str = ""
    trace_id: str = ""
    span_id: str = ""
    timestamp_ns: int = field(default_factory=time.time_ns)


class AutonomousAgentSchedulerService:
    """
    Central coordination engine for AAS.
    Manages quantum slices, entropy checks, and bidirectional stream queues.
    """

    def __init__(self, max_entropy_threshold: float = 0.88):
        self.max_entropy_threshold = max_entropy_threshold
        self.agents: Dict[str, AgentRegistration] = {}
        self.payload_queues: Dict[str, asyncio.Queue[PayloadEnvelope]] = {}
        self._lock = asyncio.Lock()

    async def register_agent(
        self,
        agent_id: str,
        role: AgentRole,
        capability_tags: List[str],
        metadata: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        async with self._lock:
            slice_id = f"slice_{agent_id}_{uuid.uuid4().hex[:8]}"
            reg = AgentRegistration(
                agent_id=agent_id,
                role=role,
                capability_tags=capability_tags,
                assigned_slice_id=slice_id,
                registered_at=time.time(),
            )
            self.agents[agent_id] = reg
            if agent_id not in self.payload_queues:
                self.payload_queues[agent_id] = asyncio.Queue()

            logger.info(f"[AAS_REGISTER] Agent '{agent_id}' ({role.value}) registered with slice '{slice_id}'.")
            return {
                "accepted": True,
                "assigned_slice_id": slice_id,
                "heartbeat_interval_ms": 5000,
                "error_message": "",
            }

    async def schedule_slice(self, req: ScheduleRequest) -> ScheduleResponse:
        """
        Calculates and grants an execution time-slice for an agent request.
        Enforces Shannon entropy mitigation directly at the scheduling gate.
        """
        async with self._lock:
            agent = self.agents.get(req.agent_id)
            if not agent:
                return ScheduleResponse(
                    agent_id=req.agent_id,
                    slice_id="",
                    granted=False,
                    granted_quantum_ms=0,
                    status=AgentStatus.HALTED,
                    reason="Agent not registered in AAS matrix",
                    sequence_number=req.sequence_number,
                    server_timestamp_ns=time.time_ns(),
                )

            # Entropy Loop Defense Check
            if req.shannon_entropy >= self.max_entropy_threshold:
                agent.status = AgentStatus.FROZEN
                logger.warning(
                    f"[AAS_GUARD] Agent '{req.agent_id}' FROZEN due to entropy loop: "
                    f"{req.shannon_entropy:.3f} >= {self.max_entropy_threshold}"
                )
                return ScheduleResponse(
                    agent_id=req.agent_id,
                    slice_id=agent.assigned_slice_id,
                    granted=False,
                    granted_quantum_ms=0,
                    status=AgentStatus.FROZEN,
                    reason=f"Shannon entropy cap breached ({req.shannon_entropy:.2f})",
                    sequence_number=req.sequence_number,
                    server_timestamp_ns=time.time_ns(),
                )

            # Calculate slice quantum based on priority
            quantum = req.requested_slice_quantum_ms
            if req.priority == SchedulingPriority.REALTIME:
                quantum = min(50, max(5, quantum))
            elif req.priority == SchedulingPriority.STANDARD:
                quantum = min(200, max(20, quantum))
            else:
                quantum = min(1000, max(50, quantum))

            agent.status = AgentStatus.BUSY
            return ScheduleResponse(
                agent_id=req.agent_id,
                slice_id=agent.assigned_slice_id,
                granted=True,
                granted_quantum_ms=quantum,
                status=AgentStatus.BUSY,
                reason="Granted nominal scheduling quantum",
                sequence_number=req.sequence_number,
                server_timestamp_ns=time.time_ns(),
            )

    async def route_payload(self, envelope: PayloadEnvelope) -> bool:
        """
        Zero-copy asynchronous payload router over memory queues.
        """
        target_queue = self.payload_queues.get(envelope.recipient_agent_id)
        if target_queue:
            await target_queue.put(envelope)
            return True
        logger.warning(f"[AAS_ROUTER] Recipient agent '{envelope.recipient_agent_id}' has no active stream queue.")
        return False

    async def stream_payloads_for_agent(self, agent_id: str) -> AsyncIterator[PayloadEnvelope]:
        q = self.payload_queues.get(agent_id)
        if not q:
            return
        while True:
            envelope = await q.get()
            yield envelope
            q.task_done()
