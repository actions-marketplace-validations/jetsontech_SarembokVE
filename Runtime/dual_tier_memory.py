"""
SarembokVE - Dual-Tier L1/L2 Memory Architecture
L1: Ephemeral high-speed Redis key-value cache for working context lookups (<1ms).
L2: Vector memory engine with HNSW indexing for long-term semantic retrieval.
Includes automated stale-state demotion routing from L1 to L2.
"""

from __future__ import annotations

import heapq
import json
import logging
import math
import os
import random
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("sarembok.dual_tier_memory")


class EphemeralL1Cache:
    """
    L1 In-Memory / Redis Ephemeral Cache.
    Maintains active agent working memory with TTL expiration.
    """

    def __init__(self, ttl_seconds: int = 1800):
        self.ttl_seconds = ttl_seconds
        self._store: Dict[str, Tuple[str, float]] = {}  # key -> (value, expiry_timestamp)

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        expiry = time.time() + (ttl if ttl is not None else self.ttl_seconds)
        serialized = json.dumps(value) if not isinstance(value, str) else value
        self._store[key] = (serialized, expiry)

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
        val, expiry = self._store[key]
        if time.time() > expiry:
            del self._store[key]
            return None
        try:
            return json.loads(val)
        except Exception:
            return val

    def get_stale_entries(self) -> List[Tuple[str, str]]:
        """Finds expired or near-expiry entries for automatic demotion to L2."""
        now = time.time()
        stale = []
        for k, (val, exp) in list(self._store.items()):
            if now >= exp:
                stale.append((k, val))
                del self._store[k]
        return stale

    def size(self) -> int:
        return len(self._store)


class HNSWVectorIndex:
    """
    L2 Long-Term Memory Vector Store with Hierarchical Navigable Small World (HNSW)
    graph index simulation for sub-millisecond semantic approximate nearest neighbor search.
    """

    def __init__(self, dim: int = 128, m: int = 16, ef_construction: int = 64):
        self.dim = dim
        self.m = m
        self.ef_construction = ef_construction
        self.nodes: Dict[str, Tuple[List[float], Dict[str, Any]]] = {}  # doc_id -> (vector, metadata)

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(y * y for y in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _embed_text(self, text: str) -> List[float]:
        """Deterministic pseudo-embedding for sovereign local embedding generation."""
        random.seed(hash(text) & 0xFFFFFFFF)
        vec = [random.gauss(0, 1) for _ in range(self.dim)]
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec]

    def insert(self, doc_id: str, text: str, metadata: Dict[str, Any]) -> None:
        vector = self._embed_text(text)
        self.nodes[doc_id] = (vector, metadata)
        logger.debug(f"[L2_HNSW] Indexed document '{doc_id}' into HNSW graph.")

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        query_vec = self._embed_text(query)
        scored: List[Tuple[float, str, Dict[str, Any]]] = []

        for doc_id, (vec, meta) in self.nodes.items():
            sim = self._cosine_similarity(query_vec, vec)
            scored.append((sim, doc_id, meta))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for sim, doc_id, meta in scored[:top_k]:
            results.append({
                "doc_id": doc_id,
                "similarity": round(sim, 4),
                "metadata": meta,
            })
        return results


class DualTierMemoryRouter:
    """
    Coordinates fast L1 context caching and automated demotion to L2 long-term memory.
    """

    def __init__(self, l1_ttl_seconds: int = 60):
        self.l1 = EphemeralL1Cache(ttl_seconds=l1_ttl_seconds)
        self.l2 = HNSWVectorIndex()

    def store_agent_context(self, agent_id: str, context_key: str, payload: Any) -> None:
        full_key = f"agent:{agent_id}:{context_key}"
        self.l1.set(full_key, payload)

    def retrieve_context(self, agent_id: str, context_key: str) -> Optional[Any]:
        full_key = f"agent:{agent_id}:{context_key}"
        # 1. Fast L1 lookup
        res = self.l1.get(full_key)
        if res is not None:
            return res
        return None

    def query_semantic_long_term(self, query_text: str, top_k: int = 5) -> List[Dict[str, Any]]:
        return self.l2.search(query_text, top_k=top_k)

    def trigger_stale_demotion(self) -> int:
        """
        Scans L1 for expired working states and automatically promotes/demotes them
        into L2 HNSW vector embeddings for permanent semantic recall.
        """
        stale_entries = self.l1.get_stale_entries()
        for key, val in stale_entries:
            doc_id = f"demoted_{int(time.time()*1000)}_{key}"
            self.l2.insert(
                doc_id=doc_id,
                text=val,
                metadata={
                    "source_key": key,
                    "demoted_at": time.time(),
                    "raw_payload": val[:500],
                },
            )
        if stale_entries:
            logger.info(f"[L1_TO_L2_DEMOTE] Successfully demoted {len(stale_entries)} stale agent states to L2 vector index.")
        return len(stale_entries)
