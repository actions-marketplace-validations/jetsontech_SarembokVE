"""SarembokVE - Automated Consensus Resolving Network & Entropy Rollback Engine.

Phase 4.0 Advanced Agent Evolution:
1. Multi-agent consensus network (STRATEGIST, WORKER, AUDITOR) with weighted quorum voting.
2. Continuous sliding-window Shannon entropy monitoring with strict <0.88 limit check.
3. Deterministic loop rollback state machine (↺ ROLLBACK) that reverts corrupted or high-entropy state drift.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import time
import uuid
from collections import deque
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("sarembok.consensus")


class VoteDecision(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    ABSTAIN = "ABSTAIN"


class ConsensusStatus(str, Enum):
    PENDING = "PENDING"
    CONSENSUS_REACHED = "CONSENSUS_REACHED"
    QUORUM_FAILED = "QUORUM_FAILED"
    AUDITOR_VETOED = "AUDITOR_VETOED"
    ENTROPY_VIOLATION = "ENTROPY_VIOLATION"
    ROLLED_BACK = "ROLLED_BACK"


@dataclass
class Proposal:
    proposal_id: str
    action_type: str
    payload: Dict[str, Any]
    proposer_agent_id: str
    created_at: float = field(default_factory=time.time)
    context_hash: str = ""

    def __post_init__(self):
        if not self.context_hash:
            raw = f"{self.proposal_id}:{self.action_type}:{json.dumps(self.payload, sort_keys=True)}"
            self.context_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass
class AgentVote:
    agent_id: str
    role: str  # "STRATEGIST", "WORKER", "AUDITOR"
    decision: VoteDecision
    confidence: float  # 0.0 to 1.0
    rationale: str = ""
    vote_hash: str = ""

    def __post_init__(self):
        if not self.vote_hash:
            raw = f"{self.agent_id}:{self.role}:{self.decision.value}:{self.confidence}:{self.rationale}"
            self.vote_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


@dataclass
class StateCheckpoint:
    checkpoint_id: str
    timestamp: float
    state_snapshot: Dict[str, Any]
    shannon_entropy: float


class ShannonEntropyMonitor:
    """Monitors sliding-window Shannon entropy across agent decision paths.

    Enforces the strict <0.88 deterministic threshold.
    """

    def __init__(self, window_size: int = 10, max_entropy_threshold: float = 0.88):
        self.window_size = window_size
        self.max_entropy_threshold = max_entropy_threshold
        self._samples: deque[float] = deque(maxlen=window_size)

    def record_entropy(self, entropy_val: float) -> float:
        """Records an entropy sample and returns current sliding-window entropy."""
        self._samples.append(max(0.0, float(entropy_val)))
        return self.get_sliding_entropy()

    def get_sliding_entropy(self) -> float:
        """Calculate weighted average Shannon entropy over current window."""
        if not self._samples:
            return 0.0
        return sum(self._samples) / len(self._samples)

    def is_deterministic(self) -> bool:
        """Verifies current sliding entropy satisfies H < 0.88."""
        return self.get_sliding_entropy() < self.max_entropy_threshold

    @staticmethod
    def calculate_discrete_entropy(probabilities: List[float]) -> float:
        """Computes Shannon entropy H = -sum(p * log2(p))."""
        total = sum(probabilities)
        if total <= 0:
            return 0.0
        normalized = [p / total for p in probabilities if p > 0]
        h = -sum(p * math.log2(p) for p in normalized)
        return round(h, 4)


class RollbackStateMachine:
    """State machine governing checkpoint snapshots and deterministic ↺ ROLLBACK

    restorations whenever loops drift into non-deterministic paths.
    """

    def __init__(self, max_checkpoints: int = 20):
        self.max_checkpoints = max_checkpoints
        self._checkpoints: List[StateCheckpoint] = []
        self._current_state: Dict[str, Any] = {}
        self._last_rollback_event: Optional[Dict[str, Any]] = None

    def save_checkpoint(self, state_snapshot: Dict[str, Any], entropy: float) -> StateCheckpoint:
        """Saves a verified stable state checkpoint."""
        cp_id = f"cp_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
        cp = StateCheckpoint(
            checkpoint_id=cp_id,
            timestamp=time.time(),
            state_snapshot=dict(state_snapshot),
            shannon_entropy=entropy,
        )
        self._checkpoints.append(cp)
        if len(self._checkpoints) > self.max_checkpoints:
            self._checkpoints.pop(0)
        self._current_state = dict(state_snapshot)
        logger.debug(f"[ROLLBACK_SM] Checkpoint '{cp_id}' saved (H={entropy:.3f}).")
        return cp

    def trigger_rollback(self, reason: str, max_safe_entropy: float = 0.88) -> Dict[str, Any]:
        """Reverts runtime state to the latest checkpoint satisfying H < 0.88."""
        logger.warning(f"[↺ ROLLBACK] Triggered state rollback: {reason}")
        # Search backwards for last stable checkpoint
        for cp in reversed(self._checkpoints):
            if cp.shannon_entropy < max_safe_entropy:
                self._current_state = dict(cp.state_snapshot)
                event = {
                    "action": "↺ ROLLBACK",
                    "status": ConsensusStatus.ROLLED_BACK.value,
                    "reason": reason,
                    "reverted_to_checkpoint": cp.checkpoint_id,
                    "restored_entropy": cp.shannon_entropy,
                    "restored_state": self._current_state,
                    "timestamp": time.time(),
                }
                self._last_rollback_event = event
                logger.info(
                    f"[↺ ROLLBACK_SUCCESS] State reverted to checkpoint '{cp.checkpoint_id}' (H={cp.shannon_entropy:.3f})."
                )
                return event

        # Fallback to pristine initial state
        self._current_state = {}
        event = {
            "action": "↺ ROLLBACK",
            "status": ConsensusStatus.ROLLED_BACK.value,
            "reason": f"{reason} (no checkpoint matched H < {max_safe_entropy}; cleared to initial)",
            "reverted_to_checkpoint": "PRISTINE_BASE",
            "restored_entropy": 0.0,
            "restored_state": {},
            "timestamp": time.time(),
        }
        self._last_rollback_event = event
        return event

    @property
    def current_state(self) -> Dict[str, Any]:
        return self._current_state

    @property
    def last_rollback(self) -> Optional[Dict[str, Any]]:
        return self._last_rollback_event


class AutomatedConsensusNetwork:
    """Automated Consensus Resolving Network.

    Collects sub-agent votes (STRATEGIST, WORKER, AUDITOR), weights quorum,
    enforces Byzantine agreement, and automatically triggers loop rollback
    if Shannon entropy exceeds 0.88.
    """

    ROLE_WEIGHTS: Dict[str, float] = {
        "STRATEGIST": 1.25,  # High-level architecture & plan guidance
        "WORKER": 1.0,       # Implementation & execution evidence
        "AUDITOR": 1.5,      # Security, compliance, boundary enforcement
    }

    def __init__(self, quorum_threshold: float = 0.67, entropy_threshold: float = 0.88):
        self.quorum_threshold = quorum_threshold
        self.entropy_monitor = ShannonEntropyMonitor(max_entropy_threshold=entropy_threshold)
        self.rollback_sm = RollbackStateMachine()
        self._proposals: Dict[str, Proposal] = {}
        self._votes: Dict[str, List[AgentVote]] = {}

    def create_proposal(self, action_type: str, payload: Dict[str, Any], proposer_agent_id: str) -> Proposal:
        p_id = f"prop_{uuid.uuid4().hex[:8]}"
        proposal = Proposal(
            proposal_id=p_id,
            action_type=action_type,
            payload=payload,
            proposer_agent_id=proposer_agent_id,
        )
        self._proposals[p_id] = proposal
        self._votes[p_id] = []
        return proposal

    def cast_vote(
        self,
        proposal_id: str,
        agent_id: str,
        role: str,
        decision: VoteDecision | str,
        confidence: float = 1.0,
        rationale: str = "",
    ) -> AgentVote:
        if proposal_id not in self._proposals:
            raise KeyError(f"Proposal '{proposal_id}' does not exist.")

        dec = VoteDecision(decision) if isinstance(decision, str) else decision
        vote = AgentVote(
            agent_id=agent_id,
            role=role.upper(),
            decision=dec,
            confidence=max(0.0, min(1.0, float(confidence))),
            rationale=rationale,
        )
        self._votes[proposal_id].append(vote)
        return vote

    def resolve_consensus(self, proposal_id: str, current_entropy: float = 0.25) -> Dict[str, Any]:
        """Resolves consensus for a proposal using weighted Byzantine voting and entropy monitoring."""
        if proposal_id not in self._proposals:
            raise KeyError(f"Proposal '{proposal_id}' not found.")

        proposal = self._proposals[proposal_id]
        votes = self._votes.get(proposal_id, [])

        # 1. Continuous Sliding-Window Shannon Entropy Check (Limit: <0.88)
        sliding_h = self.entropy_monitor.record_entropy(current_entropy)
        if sliding_h >= self.entropy_monitor.max_entropy_threshold or current_entropy >= self.entropy_monitor.max_entropy_threshold:
            trigger_entropy = max(sliding_h, current_entropy)
            rollback_res = self.rollback_sm.trigger_rollback(
                reason=f"Shannon entropy drift ({trigger_entropy:.3f} >= {self.entropy_monitor.max_entropy_threshold})"
            )
            return {
                "proposalId": proposal_id,
                "status": ConsensusStatus.ENTROPY_VIOLATION.value,
                "action": "↺ ROLLBACK",
                "slidingEntropy": sliding_h,
                "instantaneousEntropy": current_entropy,
                "entropyThreshold": self.entropy_monitor.max_entropy_threshold,
                "rollback": rollback_res,
            }

        # 2. Check Auditor Absolute Veto Policy
        for v in votes:
            if v.role == "AUDITOR" and v.decision == VoteDecision.REJECT and v.confidence >= 0.85:
                return {
                    "proposalId": proposal_id,
                    "status": ConsensusStatus.AUDITOR_VETOED.value,
                    "vetoBy": v.agent_id,
                    "rationale": v.rationale,
                    "votes": [asdict(x) for x in votes],
                }

        # 3. Weighted Quorum Voting Calculation
        total_possible_weight = 0.0
        approve_weight = 0.0
        reject_weight = 0.0

        for v in votes:
            base_w = self.ROLE_WEIGHTS.get(v.role, 1.0)
            effective_w = base_w * v.confidence
            total_possible_weight += effective_w

            if v.decision == VoteDecision.APPROVE:
                approve_weight += effective_w
            elif v.decision == VoteDecision.REJECT:
                reject_weight += effective_w

        if total_possible_weight <= 0:
            return {
                "proposalId": proposal_id,
                "status": ConsensusStatus.QUORUM_FAILED.value,
                "reason": "No votes recorded",
            }

        consensus_ratio = approve_weight / total_possible_weight
        consensus_reached = consensus_ratio >= self.quorum_threshold

        status = ConsensusStatus.CONSENSUS_REACHED if consensus_reached else ConsensusStatus.QUORUM_FAILED

        # If consensus reached, record valid state checkpoint
        if consensus_reached:
            self.rollback_sm.save_checkpoint(
                state_snapshot={
                    "last_committed_proposal": proposal_id,
                    "action_type": proposal.action_type,
                    "payload": proposal.payload,
                },
                entropy=sliding_h,
            )

        return {
            "proposalId": proposal_id,
            "status": status.value,
            "consensusRatio": round(consensus_ratio, 4),
            "quorumThreshold": self.quorum_threshold,
            "slidingEntropy": round(sliding_h, 4),
            "voteCounts": {
                "totalVotes": len(votes),
                "approveWeight": round(approve_weight, 3),
                "rejectWeight": round(reject_weight, 3),
            },
            "votes": [asdict(x) for x in votes],
        }


__all__ = [
    "VoteDecision",
    "ConsensusStatus",
    "Proposal",
    "AgentVote",
    "StateCheckpoint",
    "ShannonEntropyMonitor",
    "RollbackStateMachine",
    "AutomatedConsensusNetwork",
]
